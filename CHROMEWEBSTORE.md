# Skip90 trên Chrome Web Store

Bản nháp cho phiên bản `0.3.0` ngày 13/11/2026.

## Store listing

**Product name**

Skip90

**Short description**

Assign your own keys and skip durations for HTML5 videos.

**Full description**

```text
Skip ahead in an HTML5 video by pressing one key. Skip90 starts with S and a 90-second jump.

• Add a list of shortcuts and set the minutes and seconds for each one.
• Assign any letter from A to Z. For example, use A for 10 seconds, B for 20 seconds, and C for 30 seconds.
• Change or remove any shortcut and turn the whole list on or off in the popup.
• If a tab has multiple videos, Skip90 picks one eligible video. A brief NEXT overlay on that video shows how far it moved.

Open the Skip90 popup to change a setting, then choose Save settings. Click back into the page and press your shortcut. Playback and site access depend on the player and your Chrome settings.

Your settings stay in Chrome on your device. Skip90 uses website access to find and seek eligible videos, including those embedded from other sites.
```

## Privacy practices

**Single purpose**

Skip forward in an eligible HTML5 video using keys assigned to user-configured durations.

| Quyền hoặc phạm vi | Giải thích |
| --- | --- |
| `storage` | Saves the on/off setting and the list of shortcut letters and skip durations locally so they persist after Chrome closes. |
| Content script trên `http://*/*` và `https://*/*` | Lets Skip90 handle the shortcut on video pages and find and seek an eligible video in the current tab. Embedded players can come from a different website than the page displaying them, so Chrome needs to allow access to both. |

Select **No** for remote code. The extension runs its bundled scripts and makes no network requests.

### Privacy policy copy

Chrome stores the Skip90 on/off setting and the list of shortcut letters and skip durations on this device. To handle a shortcut, Skip90 checks eligible video players in the current tab and temporarily uses playback and visibility information to select and seek one player. Skip90 does not retain viewing activity, collect analytics, transmit data to a server, or share data with third parties. Removing the extension removes its local settings.

Thông tin nhà phát hành, kênh hỗ trợ và URL chính sách công khai do chủ tài khoản Store cung cấp khi gửi bản nháp.

## Tài nguyên

- [Icon 128 px](icons/icon-128.png)
- [Ảnh popup 1280 × 800 px](store/popup-screenshot.png)
- [Ảnh giới thiệu 440 × 280 px](store/small-promo.png)
- [Gói ZIP tiện ích](dist/Skip90-0.3.0.zip)

[Quy cách hình ảnh](https://developer.chrome.com/docs/webstore/images) và [các trường Privacy practices](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).
