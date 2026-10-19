export default function HashtagFields({ values = [] }: { values?: string[] }) {
  return (
    <fieldset className="hashtag-fields">
      <legend>
        Hashtag <small>fino a 5</small>
      </legend>
      <div className="hashtag-grid">
        {Array.from({ length: 5 }, (_, i) => (
          <label key={i}>
            <span>#</span>
            <input
              name={`hashtag_${i}`}
              aria-label={`Hashtag ${i + 1}`}
              defaultValue={values[i] || ""}
              placeholder={`hashtag${i + 1}`}
              maxLength={80}
              pattern={"[#\\p{L}\\p{M}\\p{N}_]+"}
              title="Lettere, numeri e underscore, senza spazi"
            />
          </label>
        ))}
      </div>
      <p>Uno per campo. Il simbolo # viene aggiunto automaticamente.</p>
    </fieldset>
  );
}
