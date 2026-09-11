Drop intro.mp4 (~1 min, H.264/AAC, faststart) and optional intro.jpg here.
ffmpeg -i in.mp4 -movflags +faststart -vcodec libx264 -crf 24 intro.mp4
