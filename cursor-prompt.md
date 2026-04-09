# TikTok Shop Video Overlay Pipeline — Build Spec

## Overview
Build a Python script that watches a folder for new video files, applies randomized text overlays (hooks/urgency text), and outputs finished videos to a separate folder. No TikTok API interaction whatsoever.

## Folder Structure
```
X:\tiktoked\raw\       ← Drop raw filmed videos here (Google Drive synced from phone)
X:\tiktoked\done\      ← Finished videos output here (syncs back to phone)
X:\tiktoked\archive\   ← Raw videos move here after processing (so they don't get re-processed)
```

## What the Script Does
1. Watches `X:\tiktoked\raw\` for new `.mp4` / `.mov` files
2. When a new video appears, waits 5 seconds (to ensure file is fully synced/written)
3. Randomly selects a hook preset from `config.json`
4. Generates a transparent PNG overlay using Pillow (text + styled background)
5. Composites the overlay onto the video using FFmpeg
6. Saves the result to `X:\tiktoked\done\` with the same filename
7. Moves the original raw file to `X:\tiktoked\archive\`
8. Loops forever, checking every 3 seconds

## Two Overlay Styles

### Style 1: "banner"
- Positioned at top of video (roughly top 15-20% of frame)
- TWO lines of text stacked:
  - **Line 1 (main hook):** Large bold white text on a colored rounded-rectangle background (pink, blue, magenta, red, or orange — defined per preset). Examples: "TRIPLE DISCOUNT ❤️", "40% OFF ❤️", "LARGE SALE❗", "2x DISCOUNT 🚨"
  - **Line 2 (urgency):** Slightly smaller bold white text on a DIFFERENT colored rounded-rectangle background (red, white-with-black-text, etc). Examples: "4 HOURS LEFT 😭😭", "ENDS TODAY 🚨", "ENDS TODAY"
- Both rectangles are horizontally centered, line 2 slightly narrower than line 1
- Rounded corners on the rectangles (radius ~20px)
- Text is bold, large, with slight shadow/outline for readability
- Emojis rendered inline with text

### Style 2: "fulltext"
- Large white text with black stroke/outline (3-4px) for readability
- Fills roughly the top 30-40% of the 9:16 frame
- Text is center-aligned, wraps naturally
- No background box — just the stroked text directly on video
- Examples: "If you waited until today you absolutely won because this is dirt cheap rn with free shipping", "TikTok bullied the price down and now this is on a massive sale with free shipping for the next few hours 😳"
- Can include emojis at end

## config.json Structure
```json
{
  "video_width": 1080,
  "video_height": 1920,
  "font_path": "fonts/Montserrat-ExtraBold.ttf",
  "emoji_font_path": "fonts/NotoColorEmoji.ttf",
  "presets": [
    {
      "style": "banner",
      "line1_text": "TRIPLE DISCOUNT ❤️",
      "line1_bg_color": "#FF69B4",
      "line1_text_color": "#FFFFFF",
      "line2_text": "4 HOURS LEFT 😭😭",
      "line2_bg_color": "#FF0000",
      "line2_text_color": "#FFFFFF"
    },
    {
      "style": "banner",
      "line1_text": "40% OFF ❤️",
      "line1_bg_color": "#DD00FF",
      "line1_text_color": "#FFFFFF",
      "line2_text": "4 HOURS LEFT 😭😭",
      "line2_bg_color": "#FF0000",
      "line2_text_color": "#FFFFFF"
    },
    {
      "style": "banner",
      "line1_text": "LARGE SALE❗",
      "line1_bg_color": "#FF8C00",
      "line1_text_color": "#FFFFFF",
      "line2_text": "4 HOURS LEFT 😭😭",
      "line2_bg_color": "#FF0000",
      "line2_text_color": "#FFFFFF"
    },
    {
      "style": "banner",
      "line1_text": "TRIPLE DISCOUNT",
      "line1_bg_color": "#FF0000",
      "line1_text_color": "#FFFFFF",
      "line2_text": "ENDS TODAY 🚨",
      "line2_bg_color": "#FFFFFF",
      "line2_text_color": "#000000"
    },
    {
      "style": "banner",
      "line1_text": "2x DISCOUNT 🚨",
      "line1_bg_color": "#FF0000",
      "line1_text_color": "#FFFFFF",
      "line2_text": "ENDS TODAY",
      "line2_bg_color": "#FFFFFF",
      "line2_text_color": "#000000"
    },
    {
      "style": "banner",
      "line1_text": "40% OFF",
      "line1_bg_color": "#FF0000",
      "line1_text_color": "#FFFFFF",
      "line2_text": "ENDS TODAY 🚨",
      "line2_bg_color": "#FFFFFF",
      "line2_text_color": "#000000"
    },
    {
      "style": "fulltext",
      "text": "If you waited until today you absolutely won because this is dirt cheap rn with free shipping"
    },
    {
      "style": "fulltext",
      "text": "TikTok bullied the price down and now this is on a massive sale with free shipping for the next few hours 😳"
    },
    {
      "style": "fulltext",
      "text": "Anyone else grabbing a boatload of these today since it's a fraction of the price?"
    }
  ]
}
```

## Technical Requirements
- Python 3.10+
- Dependencies: Pillow, watchdog (for folder monitoring)
- FFmpeg must be installed and accessible via PATH
- Use Pillow to generate 1080x1920 transparent PNG overlays
- Use FFmpeg to composite: `ffmpeg -i input.mp4 -i overlay.png -filter_complex "overlay=0:0" -codec:a copy output.mp4`
- Preserve original video codec quality — use `-crf 18` or equivalent
- Preserve audio untouched (`-codec:a copy`)
- Handle both .mp4 and .mov input files
- Log each processed video to console with timestamp and which preset was used

## Font Notes
- Use Montserrat ExtraBold or similar heavy sans-serif for banner style
- Use a bold rounded sans-serif for fulltext style (can be same font)
- For emojis: either use a system emoji font or Noto Color Emoji — if emoji rendering is too complex, just strip emojis from text and skip them. Better to ship without emojis than get blocked on it.
- Include a `fonts/` subfolder in the project. User will drop font files there.

## Randomization
- Each video gets a randomly selected preset from the presets array in config.json
- The script ONLY uses presets defined in config.json. It does NOT generate, modify, or improvise any text. It picks one preset at random from the list exactly as written — no variation, no AI generation, no templating beyond what's in the config.
- Optional: slight Y-position jitter (±10-20px) so overlays aren't pixel-identical across videos

## Edge Cases to Handle
- File still being written (Google Drive sync) — wait for file size to stabilize before processing
- Non-video files appearing in raw folder — ignore them
- FFmpeg errors — log and skip, don't crash the watcher
- Script should run indefinitely as a background process

## What NOT to Build
- No GUI
- No TikTok API integration
- No CapCut integration
- No cloud server component — this runs locally on Windows
