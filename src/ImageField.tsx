import { useState, useEffect } from "react";
import ContentImage from "./ContentImage";
import { validateImage } from "./backend";
export default function ImageField({ path }: { path: string | null }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <div className="image-field">
      <label>
        Immagine del contenuto
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setError("");
            setUrl("");
            if (f)
              try {
                validateImage(f);
                setUrl(URL.createObjectURL(f));
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Immagine non valida.",
                );
                e.target.value = "";
              }
          }}
        />
        <small>
          JPG, PNG o WebP, massimo 5 MB. Visibile soltanto al tuo account.
        </small>
      </label>
      {url ? (
        <img
          className="attachment-preview"
          src={url}
          alt="Anteprima dell’immagine selezionata"
        />
      ) : path ? (
        <ContentImage path={path} alt="Immagine attuale del contenuto" />
      ) : null}
      {path && (
        <label className="checkbox-label">
          <input type="checkbox" name="remove_image" />
          Rimuovi l’immagine attuale
        </label>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
