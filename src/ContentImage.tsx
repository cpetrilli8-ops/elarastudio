import { useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
import { supabase } from "./backend";
export default function ContentImage({
  path,
  alt = "",
}: {
  path: string | null;
  alt?: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    setUrl("");
    if (path && supabase)
      void supabase.storage
        .from("editorial-images")
        .createSignedUrl(path, 600)
        .then(({ data }) => {
          if (alive) setUrl(data?.signedUrl || "");
        });
    return () => {
      alive = false;
    };
  }, [path]);
  return url ? (
    <img src={url} alt={alt} className="content-image" />
  ) : (
    <span className="content-image image-placeholder" aria-hidden="true">
      <ImageIcon size={23} />
    </span>
  );
}
