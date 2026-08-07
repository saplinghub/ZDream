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
    use base64::Engine;
    use std::io::Cursor;

    let screens = screenshots::Screen::all().map_err(|e| format!("未找到可用显示器: {}", e))?;
    if screens.is_empty() {
        return Err("未检测到显示器设备".to_string());
    }

    let screen = screens.into_iter().find(|s| s.display_info.is_primary).unwrap_or_else(|| {
        screenshots::Screen::all().unwrap().remove(0)
    });

    let image = screen.capture().map_err(|e| format!("原生截图捕获失败: {}", e))?;
    let mut jpg_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut jpg_bytes);
    image.write_to(&mut cursor, image::ImageOutputFormat::Jpeg(85))
        .map_err(|e| format!("全屏图片编码 Jpeg 失败: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&jpg_bytes);
    Ok(b64)
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
