use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg(target_os = "macos")]
use tauri::WebviewUrl;

#[tauri::command]
fn log_to_terminal(level: String, tag: String, msg: String) {
    println!("[FRONTEND-{}] [{}] {}", level.to_uppercase(), tag, msg);
}

#[tauri::command]
fn capture_full_screen() -> Result<String, String> {
    use std::io::Write;
    use std::time::Instant;

    let start = Instant::now();
    let screens = screenshots::Screen::all().map_err(|e| format!("未找到可用显示器: {}", e))?;
    if screens.is_empty() {
        return Err("未检测到显示器设备".to_string());
    }

    let screen = screens.into_iter().find(|s| s.display_info.is_primary).unwrap_or_else(|| {
        screenshots::Screen::all().unwrap().remove(0)
    });

    let t_cap = Instant::now();
    let image = screen.capture().map_err(|e| format!("原生截图捕获失败: {}", e))?;
    let t_enc = Instant::now();

    let width = image.width();
    let height = image.height();
    let raw_rgba = image.as_raw();

    // 向量化直接构造 32-bit Top-Down BMP 字节块 (仅 ~3ms，彻底避免常规 CPU 编解码与缓慢写盘)
    let pixel_bytes_len = raw_rgba.len();
    let file_size = 54 + pixel_bytes_len;
    let mut bmp_buf = Vec::with_capacity(file_size);

    // BMP Header (14 Bytes)
    bmp_buf.extend_from_slice(b"BM");
    bmp_buf.extend_from_slice(&(file_size as u32).to_le_bytes());
    bmp_buf.extend_from_slice(&[0, 0, 0, 0]);
    bmp_buf.extend_from_slice(&(54u32).to_le_bytes());

    // DIB Header (BITMAPINFOHEADER 40 Bytes)
    bmp_buf.extend_from_slice(&(40u32).to_le_bytes());
    bmp_buf.extend_from_slice(&(width as i32).to_le_bytes());
    bmp_buf.extend_from_slice(&(-(height as i32)).to_le_bytes()); // 负数代表 Top-Down
    bmp_buf.extend_from_slice(&(1u16).to_le_bytes());
    bmp_buf.extend_from_slice(&(32u16).to_le_bytes()); // 32-bit RGBA
    bmp_buf.extend_from_slice(&(0u32).to_le_bytes()); // BI_RGB
    bmp_buf.extend_from_slice(&(pixel_bytes_len as u32).to_le_bytes());
    bmp_buf.extend_from_slice(&[0; 16]);

    // 批量复制 RGBA 像素数据 (翻转 R/B 顺序为 BGRA 适配标准 BMP 规范)
    for chunk in raw_rgba.chunks_exact(4) {
        bmp_buf.push(chunk[2]); // B
        bmp_buf.push(chunk[1]); // G
        bmp_buf.push(chunk[0]); // R
        bmp_buf.push(chunk[3]); // A
    }

    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join("zdream_screen_capture.bmp");
    let mut file = std::fs::File::create(&file_path).map_err(|e| format!("无法创建截图文件: {}", e))?;
    file.write_all(&bmp_buf).map_err(|e| format!("写入无损 BMP 失败: {}", e))?;

    let total = Instant::now();
    let path_str = file_path.to_string_lossy().to_string();

    println!(
        "[Rust Native Capture] 屏幕截取: {:?} | 向量化无损Bmp写盘({}): {:?} | 总计耗时: {:?}",
        t_enc.duration_since(t_cap),
        path_str,
        total.duration_since(t_enc),
        total.duration_since(start)
    );

    Ok(path_str)
}

#[tauri::command]
fn crop_screen_region(x: u32, y: u32, w: u32, h: u32) -> Result<String, String> {
    use base64::Engine;
    use std::io::Cursor;

    let screens = screenshots::Screen::all().map_err(|e| format!("未找到可用显示器: {}", e))?;
    if screens.is_empty() {
        return Err("未检测到显示器设备".to_string());
    }

    let screen = screens.into_iter().find(|s| s.display_info.is_primary).unwrap_or_else(|| {
        screenshots::Screen::all().unwrap().remove(0)
    });

    let full_image = screen.capture().map_err(|e| format!("原生截图捕获失败: {}", e))?;
    let cropped = image::imageops::crop_imm(&full_image, x, y, w, h).to_image();

    let mut png_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut png_bytes);
    cropped.write_to(&mut cursor, image::ImageOutputFormat::Png)
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
