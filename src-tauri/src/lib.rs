#[cfg(target_os = "macos")]
fn make_window_transparent(window: &tauri::WebviewWindow) {
    use objc::runtime::{Object, NO};
    use objc::{class, msg_send, sel, sel_impl};

    if let Ok(ns_window) = window.ns_window() {
        unsafe {
            let ns_window = ns_window as *mut Object;
            let _: () = msg_send![ns_window, setOpaque: NO];
            let clear: *mut Object = msg_send![class!(NSColor), clearColor];
            let _: () = msg_send![ns_window, setBackgroundColor: clear];
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    #[cfg(target_os = "macos")]
                    make_window_transparent(&window);
                    let _ = window;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
