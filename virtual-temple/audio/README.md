# Recorded audio

`manifest.json` lists everything the soundscape plays:

```json
{
  "ambience.morning": "audio/ambience-morning.mp3",
  "aarti": "audio/aarti.mp3",
  "playlists": {
    "uplifting": [{ "file": "audio/music/dhaka.mp3", "title": "Dhaka", "artist": "Kevin MacLeod" }],
    "meditation": [],
    "flute": []
  }
}
```

* `ambience.<morning|afternoon|evening|night>`: a seamless loop for that time of day, decoded only while it plays. Empty slots fall back to synthesised birds and insects.
* `aarti`: played during an aarti, decoded on demand.
* `playlists`: music stations. Tracks stream (they are not decoded into memory), play whole in shuffled order and crossfade. `uplifting` and `meditation` drive the Auto setting (uplifting by day, meditation at night); any other station id shows up in code as `audio.stations`.

Add a track by dropping an MP3 into `audio/music/` and adding an entry to a playlist. Keep the licence and attribution in `CREDITS.md`.
