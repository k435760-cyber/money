import document from "../content/privacy.json";

type Block =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };
type Policy = {
  title: string;
  byline: string;
  introduction: string;
  sections: { title: string; blocks: Block[] }[];
  notes: { title: string; items: string[] };
};
const policy = document as Policy;

export function PrivacyPolicy() {
  return (
    <article className="privacy-document">
      <header className="privacy-heading">
        <h1>{policy.title}</h1>
        <p>{policy.byline}</p>
      </header>
      <p>{policy.introduction}</p>
      {policy.sections.map((section, index) => (
        <section
          key={section.title}
          aria-labelledby={`policy-article-${index + 1}`}
        >
          <h2 id={`policy-article-${index + 1}`}>{section.title}</h2>
          {section.blocks.map((block, i) =>
            block.type === "paragraph" ? (
              <p key={i}>{block.text}</p>
            ) : block.type === "list" ? (
              <ol key={i}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ) : (
              <div
                key={i}
                className={`privacy-table-wrap${block.headers.length === 3 ? " privacy-table-wide" : ""}`}
                tabIndex={block.headers.length === 3 ? 0 : undefined}
                role="region"
                aria-label={`${section.title} 표`}
              >
                <table>
                  <thead>
                    <tr>
                      {block.headers.map((header) => (
                        <th key={header} scope="col">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, column) => (
                          <td key={column}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          )}
        </section>
      ))}
      <section
        className="privacy-source-notes"
        aria-labelledby="policy-source-notes"
      >
        <h2 id="policy-source-notes">{policy.notes.title}</h2>
        <ul>
          {policy.notes.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <nav
        className="privacy-document-links"
        aria-label="개인정보 처리방침 문서"
      >
        <a
          href={`${import.meta.env.BASE_URL}privacy-policy.pdf`}
          download="한푼 개인정보 처리방침.pdf"
        >
          처리방침 PDF 다운로드
        </a>
        <a href={`${import.meta.env.BASE_URL}privacy/`}>전체 페이지로 보기</a>
      </nav>
    </article>
  );
}
