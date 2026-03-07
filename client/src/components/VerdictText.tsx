import { parseVerdict } from "@/lib/verdict";

interface Props {
  roast: string;
}

export function VerdictText({ roast }: Props) {
  const segments = parseVerdict(roast);

  return (
    <p style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.88)", margin: 0 }}>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case "currency":
            return (
              <span
                key={i}
                style={{ color: "#00E676", fontWeight: 800, letterSpacing: "-0.3px" }}
              >
                {seg.text}
              </span>
            );
          case "count":
            return (
              <span key={i} style={{ fontWeight: 800, color: "#FFFFFF" }}>
                {seg.text}
              </span>
            );
          case "category":
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  backgroundColor: seg.color,
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "0.72em",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "1px 6px 2px",
                  borderRadius: 5,
                  verticalAlign: "middle",
                  margin: "0 2px",
                  lineHeight: "1.6",
                }}
              >
                {seg.text}
              </span>
            );
          case "bold":
            return (
              <span key={i} style={{ fontWeight: 700, color: "#FFFFFF" }}>
                {seg.text}
              </span>
            );
          case "italic":
            return (
              <em key={i} style={{ color: "rgba(255,255,255,0.75)", fontStyle: "italic" }}>
                {seg.text}
              </em>
            );
          default:
            return <span key={i}>{seg.text}</span>;
        }
      })}
    </p>
  );
}
