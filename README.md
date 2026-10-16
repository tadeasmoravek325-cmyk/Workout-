# Setsmith – ukuj si sílu ⚒️

Mobilní webová aplikace (PWA) na zapisování tréninků v posilovně, inspirovaná aplikací Strong.
Funguje offline, dá se nainstalovat na plochu telefonu a všechna data zůstávají v zařízení (IndexedDB).

## Funkce

**Jako Strong**
- Zapisování tréninku: série, váha, opakování, předchozí hodnoty u každé série (klepnutím je převezmeš)
- Typy sérií: rozcvičovací (W), drop (D), do selhání (F); supersérie
- Odpočet pauzy po sérii (zvuk, vibrace, upozornění), nastavitelný pro každý cvik
- Knihovna ~90 cviků v češtině s postupem, vlastní cviky
- Rutiny ve složkách, „Aktualizovat rutinu podle tréninku“, uložení tréninku jako rutiny
- Historie s kalendářem, úprava starších tréninků, sdílení
- Grafy progrese (odhad 1RM, max. váha, objem, opakování), rekordy podle počtu opakování
- Měření těla (hmotnost, tuk, obvody) s grafy
- Kalkulačka kotoučů, 1RM kalkulačka, kg/lb, tmavý/světlý režim
- Export CSV a záloha/obnova JSON

**Navíc**
- 🧠 **Chytrý trenér** – na základě minulého tréninku navrhne dnešní váhu a opakování (přidat / zopakovat / deload)
- 🎚️ **RPE** u každé série
- 🔥 **Automatická rozcvička** spočítaná z pracovní váhy
- 🔄 **Náhrada cviku**, když je stroj obsazený
- 💪 **Objem na svalové partie** (10–20 sérií týdně) s mapou těla
- 🫀 **Připravenost svalů** – odhad regenerace podle posledního tréninku
- 🏆 **Rekordy přímo během tréninku** a shrnutí po tréninku se srovnáním s minulým
- 📅 **Týdenní cíl, série týdnů v řadě** a **plán týdne**
- 🏅 **Odznaky** (20 úspěchů)
- 📋 **Hotové programy**: 5×5, Push/Pull/Legs, Horní/Dolní, Celé tělo, Doma bez vybavení
- 📥 **Import celé historie ze Strong** (CSV export ze Strong)

**Hravé prvky (inspirace Liftoff, GymLevels, Hevy, Fitbod, Alpha Progression)**
- 🎮 **XP a úrovně** (Nováček → Legenda) – XP za trénink, série, rekordy a výzvy
- 🗓️ **Týdenní výzvy** – 3 nové výzvy každý týden + týdenní cíl
- ❄️ **Ochrana série** – za každé 4 splněné týdny dostaneš „zmrazení“, které zachrání vynechaný týden
- 🥇 **Silové ranky** (Bronz → Diamant) podle tělesné hmotnosti a pohlaví
- ✨ **Generátor tréninku** podle regenerace svalů, cíle, délky a vybavení
- 🎉 **Oslava po tréninku** s konfetami, XP a level-upem; sdílecí obrázek tréninku
- 📈 **Indikátor výkonu** u série (▲/▼ oproti minule), 📌 připnuté poznámky ke cvikům, 🧮 kotouče přímo v tréninku
- 👤 **Profil** s mapou aktivity, měsíčním přehledem a ranky; 🚀 úvodní průvodce s doporučeným programem

## Vývoj

```bash
npm install
npm run dev       # vývojový server
npm test          # testy (vitest)
npm run build     # produkční build do dist/
```

## Nasazení

Workflow `.github/workflows/deploy.yml` nasadí aplikaci na GitHub Pages při každém pushi do `main`.
Stačí v nastavení repozitáře zapnout **Settings → Pages → Source: GitHub Actions**.
Pak aplikaci otevři v mobilu a zvol „Přidat na plochu“.
