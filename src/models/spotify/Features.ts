import { Type } from "./shared";

export type Features = {
  [key: string]: unknown;
  /**
   * A measurement of whether a track is acoustic, ranging from 0 (low) - 1 (high),
   * where a value closer to 1 indicates the track is likely mostly acoustic.
   */
  acousticness: number;
  analysis_url: string;
  /**
   * A measurement of how suitable track is for dancing based on musical components,
   * such as tempo, rhtyhm stability, beat strength, and overal regularlity, ranging
   * from 0 (low) - 1 (high).
   */
  danceability: number;
  duration_ms: number;
  /**
   * A perceptual measurement of a track's intensity and activity, ranging from 0 (low)
   * - 1 (high), where a more energetic songs feel fast, load, and/or noisy (e.g., death
   * metal).
   */
  energy: number;
  id: string;
  /**
   * A measurement of the amount of vocals within a track, ranging from 0 (low) - 1 (high),
   * where a score of 0.5 or higher score typically indicates instrumental tracks.
   */
  instrumentalness: number;
  /**
   * The key the track is in, where integers map to pitches using standard Pitch Class notation:
   * 0 = C
   * 1 = C#/Db
   * 2 = D
   * 3 = D#/Eb
   * 4 = E
   * 5 = F
   * 6 = F#/Gb
   * 7 = G
   * 8 = G#/Ab
   * 9 = A
   * 10 = A#/Bb
   * 11 = B
   */
  key: number;
  /**
   * A measurement of whether an audience is present in the recording, ranging from 0 (low) -
   * 1 (high), where a value of 0.8 or greater strongly suggest the track is a live performance.
   */
  liveness: number;
  /**
   * The overall loudness of a track in decibels (dB) taken as an average for the entire track,
   * where values typically range from -60db - 0db.
   */
  loudness: number;
  /**
   * The mode indicates the modality of the track's key, whether major (1) or minor (0).
   */
  mode: number;
  /**
   * A measurement indicating the presence of spoken words within a track, ranging from 0 (low) -
   * to 1 (high), where a value of 0.66 or higher suggests a track is composed entirely of spoken
   * work (e.g.,talk show, podcase, audio book, poetry, etc.) and a value of 0.33 or lower suggest
   * a track is more musical.
   */
  speeachiness: number;
  /**
   * The overall estimated tempo of the track in beats per minute (BPM).
   */
  tempo: number;
  time_signature: number;
  track_href: string;
  type: Type.FEATURES;
  uri: string;
  /**
   * A measurement of how positive a track feels to the listener, ranging from 0 (low) to 1 (high),
   * where a value closer to 1 suggests the track is more happy, cheerful, and/or euphoric while a
   * value closer to 0 suggest a track is more sad, depressing, or angry.
   */
  valence: number;
};
