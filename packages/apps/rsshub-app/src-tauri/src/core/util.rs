use rss::Channel;
use std::error::Error;

pub async fn load_channel() -> Result<Channel, Box<dyn Error>> {
    let content = reqwest::get("https://rsshub.app/36kr/hot-list")
        .await?
        .bytes()
        .await?;
    let channel = Channel::read_from(&content[..])?;
    Ok(channel)
}
