const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const through = require('through2');

const EventEmitter = require('events');
const Speaker = require('speaker');
const { Decoder } = require('lame');

let video = null;
let audioStream = null;
let speaker = null;
let start = null;
module.exports.video = video;

function isPlaying() {
  return video && speaker && audioStream;
}
module.exports.isPlaying = isPlaying;

function isLoading() {
  return video && audioStream && !speaker;
}
module.exports.isLoading = isLoading;

function play(vid, time) {
  if (video == null) {
    const emitter = new EventEmitter();

    video = ytdl(vid, {
      format: 'mp3',
    });

    video.on('info', (info) => {
      const {
        title, loudness, relative_loudness, length_seconds, thumbnail_url,
      } = info;
      video.info = {
        title, loudness, relative_loudness, length_seconds, thumbnail_url,
      };
      emitter.emit('info');
    });

    const stream = through();
    audioStream = ffmpeg(video)
      .seekInput(time / 1000)
      .format('mp3')
      .pipe(stream)
      .pipe(Decoder());

    audioStream.on('format', (format) => {
      // Create a new speaker with the given format.
      speaker = new Speaker(format);

      // Handle the speaker finishing its audio stream.
      speaker.on('close', () => {
        video = null;
        speaker = null;
        audioStream = null;
        start = null;
        emitter.emit('close');
      });

      // Pipe the decoded audio into the speaker.
      audioStream = audioStream.pipe(speaker);
      start = Date.now() - time;
      emitter.emit('play');
    });

    // Audio Stream Termination
    audioStream.on('finish', () => {
      if (isLoading()) {
        speaker = null;
        start = null;
        emitter.emit('close');
      }
    });

    // An error occurred.
    audioStream.on('error', (error) => {
      console.log('Failed to play YouTube video.', error.toString());
      emitter.emit('error', error);
    });

    // The stream was closed externally.
    audioStream.on('close', (error) => {
      console.log('Closing audio stream on request.', error.toString());
      emitter.emit('error', error);
    });

    return emitter;
  }
  return null;
}
module.exports.play = play;

function stop() {
  if (isPlaying()) {
    console.log('Stop requested while playing. Stopping audio.');
    speaker.end();
    audioStream.end();
    video = null;
    start = null;
  } else if (isLoading()) {
    console.log('Stop requested while loading. Cleaning up.');
    audioStream.end();
    video = null;
    start = null;
  } else {
    console.log('Nothing is currently video.');
  }
}
module.exports.stop = stop;

function getInfo() {
  if (video == null) {
    return null;
  }
  return video.info;
}
module.exports.getInfo = getInfo;

function getTime() {
  console.log(start);
  if (start == null) {
    return 0;
  }
  return (Date.now() - start);
}
module.exports.getTime = getTime;
