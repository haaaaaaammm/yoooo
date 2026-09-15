import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const links = [
    { href: "/deathclock", text: "deathclock" },
    {
      href: "/nohaydiferenciasentreestoyunpoemario",
      text: "no hay diferencias entre esto y un poemario",
    },
    { href: "/archivo", text: "archivo" },
    { href: "/42", text: "42" },
  ];

  return (
    <div className="m-20">
      <div className="flex flex-col gap-4">
        {links.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            className="weird-link hover:underline"
            style={{
              animationDelay: `${index * -0.07}s`,
            }}
          >
            <span className="link-text">{link.text}</span>

            <span
              className="arrow"
              style={{
                animationDelay: `${index * -0.11}s`,
              }}
            >
              {"<------------------------------------------"}
            </span>
          </Link>
        ))}
      </div>

      <br />

      <Image
        src="/images/VISANAME.png"
        alt="name"
        width={300}
        height={300}
        className="glitch-image"
      />

      <style>{`
        .weird-link {
          color: #ff003c;
          animation: weirdBlink 0.32s steps(1, end) infinite;

          display: flex;
          align-items: center;
          gap: 8px;

          width: fit-content;
          max-width: 100%;
        }

        .link-text {
          min-width: 0;
          flex-shrink: 1;
        }

        .arrow {
          display: inline-block;

          white-space: nowrap;
          overflow: hidden;

          width: clamp(140px, 35vw, 350px);
          min-width: 80px;

          flex-shrink: 1;

          animation: arrowBlink 0.21s steps(1, end) infinite;
        }

        .glitch-image {
          animation: imageGlitch 0.27s steps(1, end) infinite;
        }

        @keyframes imageGlitch {
          0%,
          28% {
            opacity: 1;
            transform: translate(0, 0);
          }

          29%,
          32% {
            opacity: 0.15;
            transform: translate(-2px, 0);
          }

          33%,
          58% {
            opacity: 1;
            transform: translate(0, 0);
          }

          59%,
          61% {
            opacity: 0;
            transform: translate(3px, -1px);
          }

          62%,
          83% {
            opacity: 1;
            transform: translate(0, 0);
          }

          84%,
          87% {
            opacity: 0.4;
            transform: translate(-1px, 1px);
          }

          88%,
          100% {
            opacity: 1;
            transform: translate(0, 0);
          }
        }

        @keyframes weirdBlink {
          0%,
          35% {
            color: #ff003c;
          }

          36%,
          42% {
            color: #000000;
          }

          43%,
          74% {
            color: #ff003c;
          }

          75%,
          79% {
            color: #000000;
          }

          80%,
          100% {
            color: #ff003c;
          }
        }

        @keyframes arrowBlink {
          0%,
          30% {
            color: inherit;
            transform: translateX(0);
          }

          31%,
          36% {
            color: #000000;
            transform: translateX(-2px);
          }

          37%,
          67% {
            color: inherit;
            transform: translateX(0);
          }

          68%,
          72% {
            color: #000000;
            transform: translateX(2px);
          }

          73%,
          100% {
            color: inherit;
            transform: translateX(0);
          }
        }

        @media (max-width: 640px) {
          .weird-link {
            width: 100%;
          }

          .arrow {
            flex: 1;
            width: auto;
            min-width: 100px;
          }
        }
      `}</style>
    </div>
  );
}