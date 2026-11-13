#[cfg(target_os = "macos")]
fn make_window_transparent(window: &tauri::WebviewWindow) {
    use objc::runtime::{Object, NO, YES};
    use objc::{class, msg_send, sel, sel_impl};

    if let Ok(ns_window) = window.ns_window() {
        unsafe {
            let ns_window = ns_window as *mut Object;
            let clear: *mut Object = msg_send![class!(NSColor), clearColor];
            let _: () = msg_send![ns_window, setOpaque: NO];
            let _: () = msg_send![ns_window, setBackgroundColor: clear];
            // Prefer CSS shadow so rounded corners stay clean.
            let _: () = msg_send![ns_window, setHasShadow: NO];

            let content_view: *mut Object = msg_send![ns_window, contentView];
            if !content_view.is_null() {
                let _: () = msg_send![content_view, setWantsLayer: YES];
                let layer: *mut Object = msg_send![content_view, layer];
                if !layer.is_null() {
                    let cg_clear: *mut Object = msg_send![clear, CGColor];
                    let _: () = msg_send![layer, setBackgroundColor: cg_clear];
                    let _: () = msg_send![layer, setOpaque: NO];
                }
            }
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
