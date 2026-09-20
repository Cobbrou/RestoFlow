/**
 * GlobalStyle — injecte les variables CSS, animations et classes utilitaires
 * de RestoFlow directement dans le DOM via une balise <style>.
 *
 * On centralise ici tout ce qui ne peut pas être exprimé en classes Tailwind :
 *  - Import des polices Google Fonts
 *  - Classes de famille typographique (.rf-display, .rf-mono, .rf-black)
 *  - Thèmes clair / sombre (.rf-light, .rf-dark)
 *  - Animations @keyframes (pop, ticket, toast, flash…)
 *  - Style des tickets de caisse (clip-path dentelé)
 *  - Scrollbars personnalisées
 */
export default function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Archivo+Black&family=Libre+Franklin:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

      /* ── Typographie ─────────────────────────────────────── */
      .rf-root    { font-family: 'Libre Franklin', system-ui, sans-serif; }
      .rf-display { font-family: 'Fraunces', serif; }
      .rf-mono    { font-family: 'IBM Plex Mono', monospace; }
      .rf-black   { font-family: 'Archivo Black', sans-serif; }

      /* ── Thèmes ──────────────────────────────────────────── */
      .rf-light { background: #FAF6EE; color: #2B2622; }
      .rf-dark  { background: #14110D; color: #F2ECDD; }

      /* ── Animations ──────────────────────────────────────── */
      @keyframes rf-pop        { 0%   { transform: scale(.92); opacity: 0 } 100% { transform: scale(1);  opacity: 1 } }
      @keyframes rf-slideticket{ 0%   { transform: translateY(-14px) rotate(-1deg); opacity: 0 } 100% { transform: translateY(0) rotate(0); opacity: 1 } }
      @keyframes rf-pulse      { 0%, 100% { box-shadow: 0 0 0 0 rgba(46,158,91,.5) } 50% { box-shadow: 0 0 0 8px rgba(46,158,91,0) } }
      @keyframes rf-toastin    { 0%   { transform: translateX(24px); opacity: 0 } 100% { transform: translateX(0); opacity: 1 } }
      @keyframes rf-flash      { 0%, 100% { outline-color: rgba(193,54,27,.9) } 50% { outline-color: rgba(193,54,27,.2) } }
      @keyframes rf-timerblink { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }

      .rf-anim-pop    { animation: rf-pop .25s ease-out; }
      .rf-anim-ticket { animation: rf-slideticket .35s cubic-bezier(.2,.8,.3,1); }
      .rf-anim-toast  { animation: rf-toastin .3s ease-out; }
      .rf-pulse-ready { animation: rf-pulse 1.8s infinite; }
      .rf-flash-alert { animation: rf-flash 1.4s infinite; outline: 2px solid; outline-offset: 2px; }
      .rf-timer-critical { animation: rf-timerblink 1s infinite; }

      /* ── Ticket de caisse (bord dentelé) ─────────────────── */
      .rf-ticket {
        background: #F5EFDF;
        color: #23201A;
        clip-path: polygon(
          0% 0%,4% 3%,8% 0%,12% 3%,16% 0%,20% 3%,24% 0%,28% 3%,32% 0%,
          36% 3%,40% 0%,44% 3%,48% 0%,52% 3%,56% 0%,60% 3%,64% 0%,68% 3%,
          72% 0%,76% 3%,80% 0%,84% 3%,88% 0%,92% 3%,96% 0%,100% 0%,
          100% 100%,0% 100%
        );
        padding-top: 18px;
      }

      /* ── Scrollbars ──────────────────────────────────────── */
      .rf-scrollbar::-webkit-scrollbar        { width: 8px; height: 8px; }
      .rf-scrollbar::-webkit-scrollbar-thumb  { background: rgba(0,0,0,.15); border-radius: 8px; }
      .rf-dark .rf-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); }

      /* ── Feedback tactile ────────────────────────────────── */
      .rf-tap          { transition: transform .12s ease, box-shadow .12s ease; }
      .rf-tap:active   { transform: scale(.97); }

      /* ── Impression ticket ───────────────────────────────── */
      @media print {
        body * { visibility: hidden; }
        #rf-print-receipt, #rf-print-receipt * { visibility: visible; }
        #rf-print-receipt { position: fixed; inset: 0; margin: 0; padding: 22px; background: #fff; }
      }
    `}</style>
  );
}
