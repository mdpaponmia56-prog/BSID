export function printGeneratedIdCard(params: {
  frontUrl: string;
  backUrl: string;
  bsId: string;
  fullName: string;
}) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Please allow pop-ups in your browser to print the ID card.");
    return;
  }

  const safeTitle = `BS-ID-${params.bsId} (${params.fullName})`.replace(
    /[<>]/g,
    ""
  );

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${safeTitle}</title>
  <style>
    @page { margin: 10mm; }
    body {
      margin: 0;
      padding: 24px;
      font-family: Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      background: #ffffff;
    }
    .cards {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      justify-content: center;
      align-items: flex-start;
    }
    .card-wrap {
      text-align: center;
    }
    .card-wrap img {
      width: 54mm;
      height: auto;
      border: 0.5pt solid #d4d4d8;
      border-radius: 3mm;
      display: block;
    }
    .label {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    @media print {
      body { padding: 0; }
      .label { display: none; }
    }
  </style>
</head>
<body>
  <div class="cards">
    <div class="card-wrap">
      <div class="label">Front Side</div>
      <img id="frontImg" src="${params.frontUrl}" alt="Front ID Card" />
    </div>
    <div class="card-wrap">
      <div class="label">Back Side</div>
      <img id="backImg" src="${params.backUrl}" alt="Back ID Card" />
    </div>
  </div>
  <script>
    const imgs = [document.getElementById('frontImg'), document.getElementById('backImg')];
    Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })))
      .then(() => { setTimeout(() => { window.focus(); window.print(); }, 250); });
  </script>
</body>
</html>`);
  win.document.close();
}
