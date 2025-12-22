import React, { useState } from 'react';
import { FileIcon, Download, Play, Pause, ImageIcon, FileText, Film, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';

interface MediaContent {
  msgtype: string;
  body: string;
  url?: string;
  info?: {
    mimetype?: string;
    size?: number;
    w?: number;
    h?: number;
    duration?: number;
    thumbnail_url?: string;
  };
}

interface MediaMessageProps {
  content: MediaContent;
  homeserverUrl: string;
}

export function MediaMessage({ content, homeserverUrl }: MediaMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  const getMxcUrl = (mxcUrl?: string) => {
    if (!mxcUrl) return '';
    // Convert mxc://server/media to https://server/_matrix/media/v3/download/server/media
    const match = mxcUrl.match(/^mxc:\/\/([^/]+)\/(.+)$/);
    if (match) {
      return `${homeserverUrl}/_matrix/media/v3/download/${match[1]}/${match[2]}`;
    }
    return mxcUrl;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const getFileIcon = (mimetype?: string) => {
    if (!mimetype) return <FileIcon className="h-8 w-8" />;
    if (mimetype.startsWith('image/')) return <ImageIcon className="h-8 w-8" />;
    if (mimetype.startsWith('video/')) return <Film className="h-8 w-8" />;
    if (mimetype.startsWith('audio/')) return <Music className="h-8 w-8" />;
    if (mimetype.includes('pdf')) return <FileText className="h-8 w-8" />;
    return <FileIcon className="h-8 w-8" />;
  };

  const mediaUrl = getMxcUrl(content.url);
  const thumbnailUrl = getMxcUrl(content.info?.thumbnail_url);

  // Image message
  if (content.msgtype === 'm.image') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button className="block max-w-sm rounded-lg overflow-hidden hover:opacity-90 transition-opacity">
            <img
              src={thumbnailUrl || mediaUrl}
              alt={content.body}
              className="max-h-64 object-contain bg-muted"
              loading="lazy"
            />
            {content.body && (
              <p className="text-xs text-muted-foreground p-2 truncate">
                {content.body}
              </p>
            )}
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <img
            src={mediaUrl}
            alt={content.body}
            className="w-full h-auto max-h-[80vh] object-contain"
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Video message
  if (content.msgtype === 'm.video') {
    return (
      <div className="max-w-sm rounded-lg overflow-hidden bg-muted">
        <video
          src={mediaUrl}
          controls
          className="max-h-64 w-full"
          poster={thumbnailUrl}
        >
          Ihr Browser unterstützt keine Videowiedergabe.
        </video>
        {content.body && (
          <p className="text-xs text-muted-foreground p-2 truncate">
            {content.body}
          </p>
        )}
      </div>
    );
  }

  // Audio message
  if (content.msgtype === 'm.audio') {
    const togglePlay = () => {
      if (audioRef) {
        if (isPlaying) {
          audioRef.pause();
        } else {
          audioRef.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    return (
      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-sm">
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{content.body}</p>
          {content.info?.duration && (
            <p className="text-xs text-muted-foreground">
              {Math.floor(content.info.duration / 60)}:{String(content.info.duration % 60).padStart(2, '0')}
            </p>
          )}
        </div>
        <audio
          ref={setAudioRef}
          src={mediaUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      </div>
    );
  }

  // File message (default)
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={content.body}
      className={cn(
        "flex items-center gap-3 p-3 bg-muted rounded-lg max-w-sm",
        "hover:bg-muted/80 transition-colors group"
      )}
    >
      <div className="flex-shrink-0 text-muted-foreground">
        {getFileIcon(content.info?.mimetype)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{content.body}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(content.info?.size)}
          {content.info?.mimetype && ` • ${content.info.mimetype}`}
        </p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}
