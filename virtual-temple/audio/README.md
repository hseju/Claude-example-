# Recorded audio (optional)

Put licensed recordings here and list them in `manifest.json`, for example:

```json
{
  "ambience.morning": "audio/dawn-birds.mp3",
  "music.evening": "audio/sandhya-bhajan.mp3",
  "aarti": "audio/aarti.mp3"
}
```

Keys: `ambience.morning|afternoon|evening|night`, `music.morning|afternoon|evening|night`, `aarti`.
Each listed file replaces the matching synthesised layer; anything not listed stays synthesised.
Keep each file's licence and attribution next to it.
