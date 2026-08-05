import React from "react";
import TreasuryPanel from "../components/treasury/TreasuryPanel";

export default function Tesoreria() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Tesorería</h1>
          <p>Caja física y cuenta SINPE</p>
        </div>
      </div>

      <TreasuryPanel />
    </>
  );
}
