export interface Playlist {
  data: {
    playlistV2: {
      __typename: "Playlist";
      abuseReportingEnabled: boolean;
      attributes: Attribute[];
      basePermission: Permission;
      content: PlaylistItemPage;
      currentUserCapabilities: UserCapabilities;
      description: string;
      followers: number;
      following: boolean;
      format: string;
      images: ImagesData;
      members: Members;
      name: string;
      ownerV2: User;
      revisionId: string;
      sharingInfo: Sharing;
      uri: `spotify:playlist:${string}`;
      visualIdentity: VisualIdentity;
      watchFeedEntrypoint: WatchFeed;
    };
  };
}

export interface PlaylistItemPage {
  __typename: "PlaylistItemPage";
  items: PlaylistItem[];
  pagingInfo: Pagination;
  totalCount: number;
}

export interface PlaylistItem {
  addedAt: Datetime;
  addedBy: User | null;
  attributes: Attribute[];
  itemV2: TrackResponseWrapper;
  itemV3: EntityResponseWrapper;
  uid: string;
}

export interface TrackResponseWrapper {
  data: {
    __typename: "Track";
    albumOfTrack: Album;
    artists: Artists;
    associationV3: Associations;
    contentRating: ContentRating;
    discNumber: number;
    mediaType: MediaType;
    name: string;
    playability: Playability;
    playcount: string;
    trackDuration: Duration;
    trackNumber: number;
    uri: `spotify:track:${string}`;
  };
}

export type MediaType = "AUDIO";

export interface Playability {
  playable: boolean;
  reason: string;
}

export interface Duration {
  totalMilliseconds?: number;
  nanoSeconds?: number;
  seconds?: number;
}

export interface EntityResponseWrapper {
  __typename: "EntityResponseWrapper";
  data: Entity;
}

export interface ConsumptionExperienceTrait {
  __typename: "ConsumptionExperienceTrait";
  contentRatings: ContentRating[];
  duration: Duration;
  formats: string[];
}

export interface IdentityTrait {
  __typename: "IdentityTrait";
  contentHierarchyParent?: Entity;
  contributors?: Artists;
  description?: string;
  name: string;
  type?: string;
}

export interface Entity {
  __typename: "Entity";
  consumptionExperienceTrait?: ConsumptionExperienceTrait;
  identityTrait: IdentityTrait;
  publishingMetadataTrait: PublishingMetadataTrait;
  playability?: Playability;
  uri: `spotify:${string}`;
}

export interface PublishingMetadataTrait {
  __typename: "PublishingMetadataTrait";
  firstPublished: Datetime;
}

export interface ContentRating {
  label: string;
}

export interface Album {
  artists: Artists;
  coverArt: ImageData;
  date?: Datetime;
  name: string;
  uri: `spotify:album:${string}`;
}

export interface Artists {
  items: Artist[];
}

export interface Artist {
  profile: ArtistProfile;
  uri: `spotify:artist:${string}`;
}

export interface ArtistProfile {
  name: string;
}

export interface Associations {
  audioAssociations: TrackAudioAssociationPage;
  videoAssociations: VideoAssociations;
}

export interface VideoAssociations {
  totalCount: number;
}

export interface TrackAudioAssociationPage {
  __typename: "TrackAudioAssociationPage";
  items: unknown[];
}

export interface Datetime {
  isoString: string;
}

export interface Pagination {
  limit: number;
  offset: number;
}

export interface ImagesData {
  items: ImageData[];
}

export interface ImageData {
  sources: ImageDataSource[];
}

export interface ImageDataSource {
  [key: string]: unknown;
  height: number;
  width: number;
  url: string;
}

export interface Image {
  __typename: "ImageV2";
  imageId: string;
  imageIdType: string;
  sources: ImageSource[];
}

export interface ImageSource {
  imageFormat: string;
  maxHeight: number;
  maxWidth: number;
  url: string;
}

export interface Members {
  items: Member[];
  totalCount: number;
}

export interface Member {
  isOwner: boolean;
  permissionLevel: Permission;
  user: User;
}

export interface Thumbnail {
  data: Image;
}

export interface User {
  data: {
    __typename: "User";
    avatar: Image;
    name: string;
    socialHandle: string | null;
    uri: `spotify:user:${string}`;
    username: string;
  };
}

export interface Sharing {
  shareId: string;
  shareUrl: string;
}

export interface WatchFeed {
  entrypointUrl: `spotify:watch-feed:${string}`;
  thumbnailImage: Thumbnail;
  video: null;
}

export interface VisualIdentity {
  squareCoverImage: VisualIdentityImage;
}

export interface VisualIdentityImage {
  __typename: "VisualIdentityImage";
  extractedColorSet: ColorSet;
}

export interface ColorSet {
  [name: string]: Color | ColorSet;
}

export interface Color {
  alpha: number;
  blue: number;
  green: number;
  red: number;
}

export type Permission = "VIEWER" | "CONTRIBUTOR";

export interface Attribute {
  key: string;
  value: string;
}

export interface UserCapabilities {
  canAbuseReport: boolean;
  canAdministratePermissions: boolean;
  canCancelMembership: boolean;
  canEditItems: boolean;
  canEditMetadata: boolean;
  canMixPlaylist: boolean;
  canView: boolean;
}
