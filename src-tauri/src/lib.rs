use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg(target_os = "macos")]
use tauri::{Manager, WebviewUrl};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "init_zdream_schema",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:zdream.db", migrations)
                .build(),
        )
        .setup(|app| {
            // Float 窗口预创建
            #[cfg(target_os = "macos")]
            {
                let win = tauri::WebviewWindowBuilder::new(
                    app,
                    "float",
                    WebviewUrl::App("/#/float".into()),
                )
                .title("梦金囊")
                .inner_size(360.0, 500.0)
                .min_inner_size(48.0, 48.0)
                .resizable(false)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .visible_on_all_workspaces(true)
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
