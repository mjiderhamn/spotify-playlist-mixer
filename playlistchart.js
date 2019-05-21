// See http://organizeyourmusic.playlistmachinery.com for some inspiration

class Charter {
  
  constructor() {
    this.tracks = [];
    this.tracksById = new Map();
    this.albumIds = new Set();
  }
  
  addTrack(trackDetails) {
    this.tracks.push(trackDetails);
    this.tracksById.set(trackDetails.id, trackDetails);
    console.debug("Added " + JSON.stringify(trackDetails, null, 2));
    this.albumIds.add(trackDetails.albumId);
  }
  
  fetchFeatures(callback) {
    var trackIds = Array.from(this.tracksById.keys());
    console.debug("Fetching features for " + trackIds.length + " tracks");
    // TODO Limit to 100
    var charter = this;
    spotifyApi.getAudioFeaturesForTracks(trackIds, function (xhr, features) {
      if(xhr) {
        var error = JSON.parse(xhr.response).error;
        alert(error.status + ": " + error.message);
        console.error(xhr.responseText);
      }
      else if(features && features.audio_features) {
        for(const feature of features.audio_features) {
          charter.addFeatures(feature.id, feature);
          console.debug("Track with features: " + JSON.stringify(charter.tracksById.get(feature.id), null, 2)); // TODO Remove?
        }
        
        if(callback) {
          callback.call();
        }
      }
    });
  }
  
  addFeatures(trackId, features) {
    let trackDetails = this.tracksById.get(trackId);
    trackDetails.addFeatures(features);
    return trackDetails;
  }
  
  getAllArtists() {
    const output = new Set();
    this.tracks.forEach(track => track.artists.forEach(artist => output.add(artist)));
    return output;
  }
  
  getNoOfTracksPerYear() {
    const output = new Map();
    this.tracks.forEach(track => output.set(track.albumReleaseYear, 1 + (output.has(track.albumReleaseYear) ? output.get(track.albumReleaseYear) : 0)));
    return output;
  }
  
  /** Get time in milliseconds between start of playlist and start of track */
  getStartTimes() {
    const output = [0];
    var i = 1;
    var total = 0;
    for(const track of this.tracks) {
      total += track.duration_ms;
      output[i++] = total; 
    }
    return output;
  }
  
  getAttribute(attributeName) {
    return this.tracks.map(track => track[attributeName]);
  }
  
  getTempos() {
    return this.getAttribute("tempo");
    // return this.tracks.map(track => Math.round(track.tempo));
  }
  
  getAcousticness() {
    return this.getAttribute("acousticness");
  }
  
}

class TrackDetails {

  constructor(track) {
    
    // this.track = track; // Uncomment to log additional features available
    
    this.id = track.id;
    this.name = track.name;
    
    this.albumId = track.album.id;

    this.artists = track.artists.map(artist => artist.name);
    this.artistIds = track.artists.map(artist => artist.id);

    this.albumReleaseYear = parseInt(track.album.release_date.substring(0, 4));

    this.duration_ms = track.duration_ms;
    
    this.popularity = track.popularity;
  }
  
  addFeatures(features) {
    // this.features = features;
    this.danceability = features.danceability;
    this.energy = features.energy;
    this.key = features.key;
    this.loudness = features.loudness;
    this.mode = features.mode;
    this.speechiness = features.speechiness;
    this.acousticness = features.acousticness;
    this.instrumentalness = features.instrumentalness;
    this.liveness = features.liveness;
    this.valence = features.valence;
    this.tempo = features.tempo;
    this.time_signature = features.time_signature;
    
    /* Example features
    {
       "danceability":0.476,
       "energy":0.527,
       "key":1,
       "loudness":-6.406,
       "mode":1,
       "speechiness":0.0399,
       "acousticness":0.661,
       "instrumentalness":0,
       "liveness":0.307,
       "valence":0.205,
       "tempo":152.117,
       "type":"audio_features",
       "id":"6LIWwxXoHqm7AuOByjFyd2",
       "uri":"spotify:track:6LIWwxXoHqm7AuOByjFyd2",
       "track_href":"https://api.spotify.com/v1/tracks/6LIWwxXoHqm7AuOByjFyd2",
       "analysis_url":"https://api.spotify.com/v1/audio-analysis/6LIWwxXoHqm7AuOByjFyd2",
       "duration_ms":231920,
       "time_signature":3
    }
     */
  }
  
}