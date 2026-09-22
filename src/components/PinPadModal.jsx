import { useState, useEffect } from "react";
import { Delete, ShieldAlert, ArrowLeft } from "lucide-react";
import Modal from "./Modal.jsx";
import { getRoleName } from "../utils/permissions.js";

export default function PinPadModal({
  isOpen,
  onClose,
  onSuccess,
  staffList = [],
  roles = [],
  mandatory = false,
  title = "Identification Équipier",
  subtitle = "Sélectionnez votre profil puis saisissez votre code PIN",
}) {
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError("");
      setSelectedStaff(null);
    }
  }, [isOpen]);

  const handleDigit = (digit) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError("");

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  const handleClear = () => {
    setPin("");
    setError("");
  };

  const verifyPin = (candidatePin) => {
    if (!selectedStaff) {
      setError("Veuillez sélectionner un équipier");
      return;
    }

    if (selectedStaff.pin === candidatePin) {
      setError("");
      onSuccess(selectedStaff);
      onClose();
    } else {
      setError("Code PIN incorrect");
      setTimeout(() => {
        setPin("");
      }, 600);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={mandatory ? () => {} : onClose}
      title={selectedStaff ? `Bonjour ${selectedStaff.name.split(" ")[0]}` : title}
      width={400}
    >
      <div className="flex flex-col items-center p-2">
        {/* Étape 1 : Choix de l'utilisateur si non sélectionné */}
        {!selectedStaff ? (
          <div className="w-full">
            <p className="text-xs text-[#6B6355] text-center mb-4">{subtitle}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto rf-scrollbar p-1">
              {staffList
                .filter((s) => s.active)
                .map((s) => {
                  const roleTitle = getRoleName(s, roles);
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedStaff(s);
                        setPin("");
                        setError("");
                      }}
                      className="rf-tap flex items-center gap-3 p-3 rounded-2xl border-2 border-black/10 bg-white hover:border-[#C1440E] hover:shadow-md transition-all text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm"
                        style={{ background: s.avatarBg || "#D9A441" }}
                      >
                        {s.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#2B2622] truncate">{s.name}</p>
                        <p className="text-[11px] text-[#8A8378] truncate font-medium">{roleTitle}</p>
                      </div>
                    </button>
                  );
                })}
            </div>
            <div className="mt-4 p-2.5 bg-black/5 rounded-xl text-[11px] text-[#6B6355] text-center">
              💡 Touchez votre nom pour déverrouiller votre session
            </div>
          </div>
        ) : (
          /* Étape 2 : Saisie du code PIN pour l'utilisateur choisi */
          <div className="w-full flex flex-col items-center">
            {/* Carte du profil actif + bouton retour */}
            <div className="flex items-center justify-between w-full mb-3 px-1">
              <button
                onClick={() => {
                  setSelectedStaff(null);
                  setPin("");
                  setError("");
                }}
                className="rf-tap flex items-center gap-1 text-xs text-[#6B6355] hover:text-[#2B2622] font-semibold py-1 px-2 rounded-lg bg-black/5"
              >
                <ArrowLeft size={14} /> Changer
              </button>

              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: selectedStaff.avatarBg || "#D9A441" }}
                />
                <span className="text-xs font-bold text-[#2B2622]">{selectedStaff.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 text-[#5B5346] font-semibold">
                  {getRoleName(selectedStaff, roles)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#6B6355] text-center mb-2">
              Saisissez le code PIN à 4 chiffres
            </p>

            {/* Affichage des 4 chiffres masqués */}
            <div className="flex justify-center items-center gap-3 my-2">
              {[0, 1, 2, 3].map((idx) => {
                const hasChar = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-11 h-12 rounded-xl flex items-center justify-center text-xl font-bold transition-all border-2 ${
                      hasChar
                        ? "border-[#C1440E] bg-[#C1440E]/10 text-[#C1440E] shadow-sm"
                        : "border-black/15 bg-black/5 text-[#8A8378]"
                    }`}
                  >
                    {hasChar ? "•" : ""}
                  </div>
                );
              })}
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="flex items-center gap-1 text-xs text-rose-600 font-semibold mb-2 animate-bounce">
                <ShieldAlert size={14} />
                {error}
              </div>
            )}

            {/* Pavé numérique tactile 3x4 */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-[280px] mt-1">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  onClick={() => handleDigit(num)}
                  className="rf-tap h-13 rounded-2xl bg-white border border-black/10 shadow-sm text-xl font-bold text-[#2B2622] hover:bg-black/5 active:scale-95 flex items-center justify-center"
                >
                  {num}
                </button>
              ))}

              <button
                onClick={handleClear}
                className="rf-tap h-13 rounded-2xl bg-black/5 text-xs font-bold text-[#6B6355] hover:bg-black/10 active:scale-95 flex items-center justify-center uppercase"
              >
                Effacer
              </button>

              <button
                onClick={() => handleDigit("0")}
                className="rf-tap h-13 rounded-2xl bg-white border border-black/10 shadow-sm text-xl font-bold text-[#2B2622] hover:bg-black/5 active:scale-95 flex items-center justify-center"
              >
                0
              </button>

              <button
                onClick={handleBackspace}
                className="rf-tap h-13 rounded-2xl bg-black/5 text-xs font-bold text-[#6B6355] hover:bg-black/10 active:scale-95 flex items-center justify-center"
                title="Effacer un chiffre"
              >
                <Delete size={20} />
              </button>
            </div>

            {/* Info PIN démo */}
            <div className="mt-3 p-1.5 bg-black/5 rounded-xl text-[10px] text-[#6B6355] text-center w-full">
              💡 Code PIN de <strong>{selectedStaff.name.split(" ")[0]}</strong> : <code>{selectedStaff.pin}</code>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
