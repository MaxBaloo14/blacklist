/** Écran d'accueil (nom + barre de chargement). Pur CSS : aucune dépendance JavaScript. */
export default function Splash() {
  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-inner">
        <div className="splash-name">BLACK<b>LIST</b></div>
        <div className="splash-sub">BOOBOO CREW</div>
        <div className="splash-bar"><i /></div>
      </div>
    </div>
  );
}
