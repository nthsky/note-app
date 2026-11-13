#[cfg(target_os = "macos")]
fn make_window_transparent(window: &tauri::WebviewWindow) {
    use objc2_app_kit::{NSColor, NSWindow};

    let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));

    if let Ok(ns_window_ptr) = window.ns_window() {
        // SAFETY: pointer comes from Tauri's live NSWindow on the main thread.
        let ns_window: &NSWindow = unsafe { &*ns_window_ptr.cast() };
        ns_window.setOpaque(false);
        let clear = NSColor::clearColor();
        ns_window.setBackgroundColor(Some(&clear));
        ns_window.setHasShadow(false);

        if let Some(content_view) = ns_window.contentView() {
            content_view.setWantsLayer(true);
            if let Some(layer) = content_view.layer() {
                layer.setBackgroundColor(Some(&clear.CGColor()));
                layer.setOpaque(false);
                layer.setCornerRadius(18.0);
                layer.setMasksToBounds(true);
            }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![init_window_chrome])
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
