var SPOTIFY_CLIENT_ID = "9f2f7495b9d74d8b805c3ce656967c2e";

var Tracks = {
  SILENCE_10s: "5XSKC4d0y0DfcGbvDOiL93",
  
  SILENCE_17s: "4ZZgjJUKOG0DarLHTmPnP8",
  
  SILENCE_30s: "3E3Kz6ZrphV9lRKhQjZAkl"
};

/** No of tracks to add to a playlist at a time, due to https://github.com/thelinmichael/spotify-web-api-node/issues/82 */
var TRACKS_PER_BATCH = 50;

var accessToken = null;
var spotifyApi = new SpotifyWebApi();

function parseParams() {
  var all = document.location.hash.replace(/#/g, '').split('&');
  var params = {};
  for(var i = 0; i < all.length; i++) {
    var keyValue = all[i].split('=');
    var key = keyValue[0];
    var value = keyValue[1];
    params[key] = value;
    // alert(key + " = " + value);
  }
  return params;
}

function login() {
  var scopes = 'playlist-read-private playlist-modify-private playlist-modify-public playlist-read-collaborative';
  document.location = 'https://accounts.spotify.com/authorize?client_id=' + SPOTIFY_CLIENT_ID +
      '&response_type=token' +
      '&scope=' + encodeURIComponent(scopes) +
      '&redirect_uri=' + encodeURIComponent(document.location);
}

// ===========================================================================0
// The mixer itself
// ===========================================================================0

function Mixer() {
  /** Tracks loaded into each category */
  this.tracksPerCategory = {};
  
  /** Cache of tracks by track ID */
  this.trackCache = {};

  /** IDs of the tracks to play when switching category. Could be a pause or some indicator. */
  this.tracksBetweenCategories = [];

  /** Tracks to play before starting over with a new cycle. Could be a silent pause or some indicator to switch partner. */
  this.tracksBetweenCycles = [];
}

/** Add tracks from given playlist URL or URI */
Mixer.prototype.appendTracksOfCategoryFromPlaylistUrl = function(category, urlOrUri, callback) {
  var userId = getUserFromPlaylistUrl(urlOrUri);
  var playlistId = getPlaylistFromPlaylistUrl(urlOrUri);
  this.appendTracksOfCategoryFromPlaylist(category, userId, playlistId, callback);
};

Mixer.prototype.appendTracksOfCategoryFromPlaylist = function(category, userId, playlistId, callback) {
  var tracksOfCategory = this.getTracksOfCategory(category);
  this.appendTracksFromPlaylist(tracksOfCategory, userId, playlistId, callback);
};

Mixer.prototype.getTracksOfCategory = function(category) {
  var tracksOfCategory = this.tracksPerCategory[category];
  if(! tracksOfCategory) {
    tracksOfCategory = [];
    this.tracksPerCategory[category] = tracksOfCategory;
  }
  return tracksOfCategory;
};

Mixer.prototype.appendTracksFromPlaylist = function(tracks, userId, playlistId, callback) {
  spotifyApi.getPlaylist(userId, playlistId, null, function(xhr, playlist) {
    if(xhr) {
      var error = JSON.parse(xhr.response).error;
      alert(error.status + ": " + error.message);
      console.error(xhr.responseText);
    }
    else if(playlist) {
      // console.log("Total tracks before: " + tracks.length);
      console.log("Playlist " + playlist.id + " @ " + playlist.href + " contains " + playlist.tracks.total + " tracks");
      // TODO Handle > 100 tracks playlist.tracks.href, playlist.tracks.limit, playlist.tracks.next, playlist.tracks.offset
      $(playlist.tracks.items).each(function(index, playlistTrack) {
        tracks.push(playlistTrack.track);
      });
      console.log("Total tracks after: " + tracks.length);
      if(callback)
        callback.call();
    }
    else
      alert("Unknown error"); // TODO
  });
};

Mixer.prototype.addTrackBetweenCategories = function(trackIdOrUrl, callback) {
  this.addTrackToArray(this.tracksBetweenCategories, trackIdOrUrl, "Category change", callback);
};

Mixer.prototype.addTrackBetweenCycles = function(trackIdOrUrl, callback) {
  this.addTrackToArray(this.tracksBetweenCycles, trackIdOrUrl, "Category change", callback);
};

Mixer.prototype.addTrackToArray = function(tracks, trackIdOrUrl, fakeCategory, callback) {
  // TODO Extract ID from track URL if needed
  console.log("Inserting track " + trackIdOrUrl);
  var placeholder = {};
  placeholder.id = trackIdOrUrl;
  placeholder.name = "*fetching*";
  placeholder.mixerCategory = fakeCategory;
  tracks.push(placeholder);
  this.getTrack(trackIdOrUrl, function (track) {
    $.extend(placeholder, track);
    if(callback)
      callback.call();
  });
};

Mixer.prototype.mix = function(cycle) {
 
  // Make copies of the categories
  var temp = {};
  // $(this.tracksPerCategory).each(function (category, tracks) {
  for(category in this.tracksPerCategory) {
    temp[category] = this.tracksPerCategory[category].slice(0); // Copy
  }
  
  this.mixUntilTracksMissing(cycle, temp);
  
  for(category in temp) {
    var remainingTracksInCategory = temp[category];
    if(remainingTracksInCategory && remainingTracksInCategory.length > 0) {
      console.log("Unused tracks of category '" + category + "' (" + remainingTracksInCategory.length + "):");
      for(var i = 0; i < remainingTracksInCategory.length; i++) {
        console.log("  " + remainingTracksInCategory[i].name);
      }
    }
    else
      console.log("All tracks in category '" + category + "' were used");
  }
};

/** NOTE! tracksPerCategory will be mutated! */
Mixer.prototype.mixUntilTracksMissing = function(cycle, tracksPerCategory) {
  this.result = [];
  this.cycle = cycle; // Remember the cycle used to create the mix
  var result = this.result;

  while(true) {
    var previousCategory = null;

    // $(cycle).each(function (index, category) { // Does not support break
    for(var c = 0; c < cycle.length; c++) {
      var category = cycle[c];
      if(this.tracksBetweenCategories && previousCategory && previousCategory !== category) {
        var categorySwitch = "'" + previousCategory + "' -> '" + category + "'"; 
        console.log("Category switching " + categorySwitch);
        this.insertTrack(result, categorySwitch, this.tracksBetweenCategories);
      }
      previousCategory = category;
      
      var tracksOfCategory = tracksPerCategory[category];
      var noOfTracks = tracksOfCategory ? tracksOfCategory.length : 0;
      if(noOfTracks == 0) {
        console.log("No more tracks of category " + category);
        return; // TODO need to throw?
      }
      var trackNo = Math.floor(Math.random() * (noOfTracks - 1));
      var track = tracksOfCategory[trackNo];
      track.mixerCategory = category;
      console.log("Adding track of category " + category + " to result: " + track.name);
      result.push(track);
      tracksOfCategory.splice(trackNo, 1); // Removes the track
    }
    
    if(this.tracksBetweenCycles) {
      console.log("Starting cycle over again");
      this.insertTrack(result, "Cycle repeat", this.tracksBetweenCycles);
    }
  }
};

Mixer.prototype.insertTrack = function(result, category, tracksToInsert) {
  for(var t = 0; t < tracksToInsert.length; t++) {
    var track = tracksToInsert[t];
    console.log("Inserting track " + track.id + " '" + track.name + "'");
    if(track) {
      track.mixerCategory = category;
      result.push(track);
    }
    else
      console.error("Track not in cache: " + trackId);
  }
};

Mixer.prototype.getTrack = function(idOrUrl, callback) {
  // TODO Extract ID from URL
  var self = this;
  if(this.trackCache[idOrUrl]) {
  }
  else {
    this.trackCache[idOrUrl] = spotifyApi.getTrack(idOrUrl, function (xhr, track) {
      console.log("Track fetched: " + JSON.stringify(track));
      self.trackCache[idOrUrl] = track;
      callback(track);
    });
  }
};

Mixer.prototype.saveResult = function () {
  if(! this.result || this.result.length == 0) {
    alert("Nothing to save!");
    return;
  }
  
  var name = "";
  for(var i = 0; i < this.cycle.length; i++) {
    name += this.cycle[i];
    if(i < this.cycle.length - 1)
      name += ", ";
  }
  name += " @ " + new Date().toString(); // toISOString() ?

  var self = this;
  
  spotifyApi.getMe(null, function (xhr, me) {
    // console.log("Me: " + JSON.stringify(me));
    var userId = me.id;
    console.log("Saving playlist with " + self.result.length + " tracks to user " + userId);
    spotifyApi.createPlaylist(userId, {
        name: name
      }, function (xhr, playlist) {
      var playlistId = playlist.id;
      console.log("Playlist created: " + playlistId);

      // Cannot do all at once https://github.com/thelinmichael/spotify-web-api-node/issues/82
      var slices = [];
      var sliceIndex = 0;
      var sliceStart = 0;
      do {
        slices[sliceIndex++] = self.result.slice(sliceStart, sliceStart + TRACKS_PER_BATCH);
        sliceStart += TRACKS_PER_BATCH;
      } while(sliceStart < self.result.length);

      console.log("Saving tracks in " + slices.length + " slices");
      saveSlice(userId, playlistId, slices, 0);
    });
  })
  
  return name;
};

function saveSlice(userId, playlistId, slices, sliceIndex) {
  var slice = slices[sliceIndex];
  var uris = [];
  for(var i = 0; i < slice.length; i++) {
    uris[i] = slice[i].uri;
  }
  console.log("Adding slice " + sliceIndex + " containing " + JSON.stringify(uris));
  
  spotifyApi.addTracksToPlaylist(userId, playlistId, uris, null, function (xhr, body) {
    if(sliceIndex < slices.length - 1) {
      saveSlice(userId, playlistId, slices, sliceIndex + 1); // Next slice
    }
  })
}

// ===========================================================================0
// URL / URI manipulation
// ===========================================================================0
// Examples
//   https://open.spotify.com/user/[userId]/playlist/[playlistId]?si=xyz
//   spotify:user:[userId]:playlist:[playlistId]


/** Get user ID given a playlist URL or URI */
function getUserFromPlaylistUrl(urlOrUri) {
  return urlOrUri.replace(/:/g, '/') // URI -> URL-ish
      .replace(/.*user\//, '').replace(/\/playlist.*/, '');
}

/** Get playlist ID given a playlist URL or URI */
function getPlaylistFromPlaylistUrl(urlOrUri) {
  return urlOrUri.replace(/:/g, '/') // URI -> URL-ish
      .replace(/.*playlist\//, '')
      .replace(/\?.*/, ''); // Remove any parameters
}