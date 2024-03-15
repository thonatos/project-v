// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod core;

#[derive(serde::Serialize)]
struct ChannelInfo {
    title: String,
    link: String,
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
async fn get_channel(_name: String) -> Result<ChannelInfo, String> {
    let raw = core::util::load_channel().await;

    match raw {
        Ok(data) => Ok(ChannelInfo {
            title: data.title,
            link: data.link,
        }),
        Err(_) => Err("No result".into()),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_channel])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
