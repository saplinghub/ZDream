use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_sql::{Migration, MigrationKind};
use std::sync::{Mutex, OnceLock};

use tauri::WebviewUrl;

/// 最近一次全屏截图缓存，供 crop_screen_region 复用，避免"预览截一次 + 裁剪再截一次"的重复截屏
struct ScreenShotCache {
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    captured_at: std::time::Instant,
}

fn screen_cache() -> &'static Mutex<Option<ScreenShotCache>> {
    static CACHE: OnceLock<Mutex<Option<ScreenShotCache>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

/// 获取主屏（优先 primary，否则第一个）
fn primary_screen() -> Result<screenshots::Screen, String> {
    let mut screens = screenshots::Screen::all().map_err(|e| format!("未找到可用显示器: {}", e))?;
    if screens.is_empty() {
        return Err("未检测到显示器设备".to_string());
    }
    let idx = screens.iter().position(|s| s.display_info.is_primary).unwrap_or(0);
    Ok(screens.remove(idx))
}

/// 从缓存像素中裁剪选区（RGBA 逐行拷贝），越界/无效返回 None
fn crop_from_cache(cache: &ScreenShotCache, x: u32, y: u32, w: u32, h: u32) -> Option<image::RgbaImage> {
    let (cw, ch) = (cache.width, cache.height);
    if w == 0 || h == 0 || x + w > cw || y + h > ch {
        return None;
    }
    let stride = cw as usize * 4;
    let mut data = Vec::with_capacity(w as usize * h as usize * 4);
    for row in 0..h as usize {
        let src_start = (y as usize + row) * stride + x as usize * 4;
        for col in 0..w as usize {
            let idx = src_start + col * 4;
            data.push(cache.pixels[idx + 2]); // R
            data.push(cache.pixels[idx + 1]); // G
            data.push(cache.pixels[idx + 0]); // B
            data.push(cache.pixels[idx + 3]); // A
        }
    }
    image::RgbaImage::from_raw(w, h, data)
}

/// 快速全屏截图：macOS 用 CoreGraphics CGDisplayCreateImage（比 screenshots crate 快 3-5 倍），
/// 其它平台退回 screenshots。返回 (RGBA 像素, 宽, 高)。
fn capture_screen_fast() -> Result<(Vec<u8>, u32, u32), String> {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::base::kCGBitmapByteOrder32Host;
        use core_graphics::color_space::CGColorSpace;
        use core_graphics::context::CGContext;
        use core_graphics::display::{CGDisplay, CGDisplayBounds};
        use core_graphics::geometry::{CGPoint, CGRect, CGSize};
        use core_graphics::image::CGImageAlphaInfo;

        let display = CGDisplay::main();
        let bounds = display.bounds();
        let width = bounds.size.width as usize;
        let height = bounds.size.height as usize;
        if width == 0 || height == 0 {
            return Err("屏幕尺寸无效".to_string());
        }

        let color_space = CGColorSpace::create_device_rgb();
        let bitmap_info: u32 =
            kCGBitmapByteOrder32Host | (CGImageAlphaInfo::CGImageAlphaPremultipliedLast as u32);

        let mut ctx = CGContext::create_bitmap_context(
            None,
            width,
            height,
            8,
            width * 4,
            &color_space,
            bitmap_info,
        );

        let img = display.image().ok_or("原生截屏失败".to_string())?;
        let rect = CGRect::new(
            &CGPoint::new(0.0, 0.0),
            &CGSize::new(bounds.size.width, bounds.size.height),
        );
        ctx.draw_image(rect, &img);

        // CGBitmapContext 输出为 BGRA (32Host + PremultipliedLast)。
        // 直接返回 BGRA：BMP 用 BGRA 掩码显示，crop 时在小区域内转 RGBA（避免全图 33MB 转换）
        let raw = ctx.data();
        Ok((raw.to_vec(), width as u32, height as u32))
    }

    #[cfg(not(target_os = "macos"))]
    {
        let screen = primary_screen()?;
        let img = screen.capture().map_err(|e| format!("原生截图捕获失败: {}", e))?;
        Ok((img.as_raw().to_vec(), img.width(), img.height()))
    }
}

#[tauri::command]
fn log_to_terminal(level: String, tag: String, msg: String) {
    println!("[FRONTEND-{}] [{}] {}", level.to_uppercase(), tag, msg);
}

#[tauri::command]
fn capture_full_screen() -> Result<String, String> {
    use std::io::Write;
    use std::time::Instant;

    let start = Instant::now();
    let (raw_rgba, width, height) = capture_screen_fast()?;
    let t_cap = Instant::now();

    // 缓存全屏 RGBA，供 crop_screen_region 复用（一次 OCR 只截一次屏，且裁剪内容与预览完全一致）
    {
        let mut cache = screen_cache().lock().unwrap();
        *cache = Some(ScreenShotCache {
            pixels: raw_rgba.clone(),
            width,
            height,
            captured_at: Instant::now(),
        });
    }

    // 0.1ms 零循环极速 BMP (使用 BITMAPV5HEADER 定义 RGBA 掩码，零 CPU 迭代)
    let pixel_bytes_len = raw_rgba.len();
    let header_size = 14 + 108;
    let file_size = header_size + pixel_bytes_len;
    let mut bmp_buf = Vec::with_capacity(file_size);

    // File Header (14 Bytes)
    bmp_buf.extend_from_slice(b"BM");
    bmp_buf.extend_from_slice(&(file_size as u32).to_le_bytes());
    bmp_buf.extend_from_slice(&[0, 0, 0, 0]);
    bmp_buf.extend_from_slice(&(header_size as u32).to_le_bytes());

    // BITMAPV5HEADER (108 Bytes)
    bmp_buf.extend_from_slice(&(108u32).to_le_bytes());
    bmp_buf.extend_from_slice(&(width as i32).to_le_bytes());
    bmp_buf.extend_from_slice(&(-(height as i32)).to_le_bytes()); // Top-down
    bmp_buf.extend_from_slice(&(1u16).to_le_bytes());
    bmp_buf.extend_from_slice(&(32u16).to_le_bytes()); // 32-bit
    bmp_buf.extend_from_slice(&(3u32).to_le_bytes()); // BI_BITFIELDS
    bmp_buf.extend_from_slice(&(pixel_bytes_len as u32).to_le_bytes());
    bmp_buf.extend_from_slice(&(2835u32).to_le_bytes());
    bmp_buf.extend_from_slice(&(2835u32).to_le_bytes());
    bmp_buf.extend_from_slice(&(0u32).to_le_bytes());
    bmp_buf.extend_from_slice(&(0u32).to_le_bytes());

    // RGBA Masks
    bmp_buf.extend_from_slice(&(0x000000FFu32).to_le_bytes()); // B
    bmp_buf.extend_from_slice(&(0x0000FF00u32).to_le_bytes()); // G
    bmp_buf.extend_from_slice(&(0x00FF0000u32).to_le_bytes()); // R
    bmp_buf.extend_from_slice(&(0xFF000000u32).to_le_bytes()); // A

    bmp_buf.extend_from_slice(b"BGRs");
    bmp_buf.extend_from_slice(&[0u8; 36]);
    bmp_buf.extend_from_slice(&[0u8; 12]);

    // 0.1ms 零循环直接内存扩展！
    bmp_buf.extend_from_slice(&raw_rgba);

    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join("zdream_screen_capture.bmp");
    let mut file = std::fs::File::create(&file_path).map_err(|e| format!("无法创建截图文件: {}", e))?;
    file.write_all(&bmp_buf).map_err(|e| format!("写入无损 BMP 失败: {}", e))?;

    let total = Instant::now();
    let path_str = file_path.to_string_lossy().to_string();

    println!(
        "[Rust Native Capture] 屏幕截取: {:?} | 零循环内存写盘({}): {:?} | 总计耗时: {:?}",
        t_cap.duration_since(start),
        path_str,
        total.duration_since(t_cap),
        total.duration_since(start)
    );

    Ok(path_str)
}

#[tauri::command]
fn crop_screen_region(x: u32, y: u32, w: u32, h: u32) -> Result<String, String> {
    use base64::Engine;
    use std::io::Cursor;

    if w == 0 || h == 0 {
        return Err("选区尺寸无效".to_string());
    }

    // 优先复用缓存的全屏截图（10 秒内有效），避免重复截屏，且裁剪内容与用户预览完全一致
    let cropped_img = {
        let cache = screen_cache().lock().unwrap();
        match cache.as_ref() {
            Some(c) if c.captured_at.elapsed().as_secs() < 10 => crop_from_cache(c, x, y, w, h),
            _ => None,
        }
    };

    let cropped_img = if let Some(img) = cropped_img {
        img
    } else {
        // 兜底：缓存缺失/过期/越界 → 重新截屏再裁剪
        let screen = primary_screen()?;
        let full = screen.capture().map_err(|e| format!("原生截图捕获失败: {}", e))?;
        let (cw, ch) = (full.width(), full.height());
        if x + w > cw || y + h > ch {
            return Err("选区超出屏幕范围".to_string());
        }
        image::imageops::crop_imm(&full, x, y, w, h).to_image()
    };

    let mut png_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut png_bytes);
    cropped_img
        .write_to(&mut cursor, image::ImageOutputFormat::Png)
        .map_err(|e| format!("选区图片编码 PNG 失败: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
    Ok(b64)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "init_zdream_schema",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![log_to_terminal, capture_full_screen, crop_screen_region])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:zdream.db", migrations)
                .build(),
        )
        .setup(|app| {
            setup_tray(app)?;

            // Float 窗口预创建
            #[cfg(target_os = "macos")]
            {
                let win = tauri::WebviewWindowBuilder::new(
                    app,
                    "float",
                    WebviewUrl::App("/#/float".into()),
                )
                .title("梦金囊")
                .inner_size(360.0, 720.0)
                .min_inner_size(48.0, 48.0)
                .resizable(true)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .visible_on_all_workspaces(true)
                .accept_first_mouse(true)
                .visible(false)
                .build()?;

                // 设为 NSNonactivatingPanelMask：点击不激活应用
                if let Ok(ns_win) = win.ns_window() {
                    let ns_win = ns_win as *mut objc2::runtime::Object;
                    unsafe {
                        use objc2::{msg_send, sel};
                        let current_mask: u64 = msg_send![ns_win, styleMask];
                        let _: () = msg_send![ns_win, setStyleMask: current_mask | 128u64];
                    }
                }
            }

            // 预创建隐藏截图窗口（跨平台）：Ctrl+A 时前端直接 show，
            // 避免 WebView2 首次创建慢（Windows ~1s）
            {
                let (cw, ch) = match app.primary_monitor().ok().flatten() {
                    Some(m) => {
                        let scale = m.scale_factor().max(0.5);
                        (m.size().width as f64 / scale, m.size().height as f64 / scale)
                    }
                    None => (1920.0, 1080.0),
                };
                let _ = tauri::WebviewWindowBuilder::new(
                    app,
                    "capture",
                    WebviewUrl::App("/#/capture".into()),
                )
                .title("截图")
                .inner_size(cw, ch)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .visible(false)
                .build();
            }
            Ok(())
        })
        // 主窗口关闭 → 隐藏到托盘（不退出应用）
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 系统托盘：点击显示主窗口，右键菜单含 显示/退出
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::AssetNotFound("default window icon".into()))?;

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("梦金囊")
        .menu(&menu)
        // Windows 左键单击显示主窗口；右键弹出菜单
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn show_main<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}
