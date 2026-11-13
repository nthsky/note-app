#[cfg(target_os = "macos")]
fn make_window_transparent(window: &tauri::WebviewWindow) {
    use objc::runtime::{Object, NO, YES};
    use objc::{class, msg_send, sel, sel_impl};

    let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));

    if let Ok(ns_window) = window.ns_window() {
        unsafe {
            let ns_window = ns_window as *mut Object;
            let clear: *mut Object = msg_send![class!(NSColor), clearColor];
            let _: () = msg_send![ns_window, setOpaque: NO];
            let _: () = msg_send![ns_window, setBackgroundColor: clear];
            let _: () = msg_send![ns_window, setHasShadow: NO];

            let content_view: *mut Object = msg_send![ns_window, contentView];
            if !content_view.is_null() {
                let _: () = msg_send![content_view, setWantsLayer: YES];
                let layer: *mut Object = msg_send![content_view, layer];
                if !layer.is_null() {
                    let cg_clear: *mut Object = msg_send![clear, CGColor];
                    let _: () = msg_send![layer, setBackgroundColor: cg_clear];
                    let _: () = msg_send![layer, setOpaque: NO];
                    let _: () = msg_send![layer, setCornerRadius: 18.0_f64];
                    let _: () = msg_send![layer, setMasksToBounds: YES];
                }
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn order_front(window: &tauri::WebviewWindow) {
    use objc::runtime::Object;
    use objc::{msg_send, sel, sel_impl};
    use std::ptr;

    if let Ok(ns_window) = window.ns_window() {
        unsafe {
            let ns_window = ns_window as *mut Object;
            let nil: *mut Object = ptr::null_mut();
            let _: () = msg_send![ns_window, makeKeyAndOrderFront: nil];
            let _: () = msg_send![ns_window, orderFrontRegardless];
        }
    }
}

#[tauri::command]
fn init_window_chrome(window: tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    make_window_transparent(&window);

    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
    }
}

#[tauri::command]
fn bring_window_to_front(app: tauri::AppHandle, label: String) -> Result<(), String> {
    use tauri::Manager;

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("window not found: {label}"))?;

    #[cfg(target_os = "macos")]
    order_front(&window);

    window
        .set_focus()
        .map_err(|error| format!("failed to focus window: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            init_window_chrome,
            bring_window_to_front
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    init_window_chrome(window);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
