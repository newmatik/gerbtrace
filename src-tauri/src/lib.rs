use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .setup(|app| {
      // Build native application menu with About metadata
      let about_metadata = AboutMetadata {
        name: Some("Gerbtrace".into()),
        version: Some(app.config().version.clone().unwrap_or_else(|| "1.0.0".into())),
        copyright: Some("© Newmatik GmbH".into()),
        authors: Some(vec!["Newmatik GmbH".into()]),
        comments: Some("View and compare Gerber PCB files.".into()),
        license: Some("MIT".into()),
        website: Some("https://gerbtrace.com".into()),
        website_label: Some("gerbtrace.com".into()),
        ..Default::default()
      };

      let check_for_updates = MenuItemBuilder::with_id("check_for_updates", "Check for Updates…")
        .build(app)?;

      let app_submenu = SubmenuBuilder::new(app, "Gerbtrace")
        .about(Some(about_metadata))
        .item(&check_for_updates)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

      let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

      let window_submenu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .close_window()
        .separator()
        .fullscreen()
        .build()?;

      let menu = MenuBuilder::new(app)
        .items(&[&app_submenu, &edit_submenu, &window_submenu])
        .build()?;

      app.set_menu(menu)?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .on_menu_event(|app, event| {
      if event.id().as_ref() == "check_for_updates" {
        // Emit event to the frontend so the JS updater composable handles it
        let _ = app.emit("menu-check-for-updates", ());
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
