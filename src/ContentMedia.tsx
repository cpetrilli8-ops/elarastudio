import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import ContentImage from "./ContentImage";
import { supabase } from "./backend";
import type { SavedMedia } from "./media";
export default function ContentMedia({
  media,
  fallback,
}: {
  media: SavedMedia[];
  fallback: string | null;
}) {
  const first = media[0];
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    setUrl("");
    if (first?.path && first.kind === "image" && supabase)
      void supabase.storage
        .from("editorial-media")
        .createSignedUrl(first.path, 600)
        .then(({ data }) => {
          if (alive) setUrl(data?.signedUrl || "");
        });
    return () => {
      alive = false;
    };
  }, [first?.path, first?.kind]);
  if (!first) return <ContentImage path={fallback} />;
  return (
    <span className="content-media-thumb">
      {first.kind === "video" ? (
        <span className="content-image image-placeholder">
          <Film size={24} />
        </span>
      ) : url ? (
        <img className="content-image" src={url} alt="" />
      ) : (
        <span className="content-image image-placeholder" />
      )}
      {media.length > 1 && <small>+{media.length - 1}</small>}
    </span>
  );
}
