# CLAUDE.md

## Tech Stack

- **Framework**: Next.js 14
- **Backend/Database**: Supabase
- **Hosting**: Vercel
- **Bot**: Telegram Bot API
- **Language**: TypeScript
- **Styling**: Tailwind CSS

## Fonctionnalités

### Prix temps réel
- Cours BTC, XAU (or), Crude Oil via API externe
- Affichage en temps réel

### Espace client
- Authentification via Supabase Auth
- Dashboard utilisateur

### Messagerie Telegram
- Intégration Telegram Bot API
- Notifications et échanges via bot

### Mini-apps
- **Calculatrice taux composés** : calcul d'intérêts composés
- **Cycles lunaires** : calendrier des phases lunaires
- **Jeu Penalty 1v1** : mini-jeu de tirs au but en 1 contre 1

### Détection visiteur
- Adresse IP
- Date/heure
- Géolocalisation GPS

### Vente USDT/USDC
- Vitrine de vente de stablecoins (USDT, USDC)
- Sans paiement intégré (contact manuel)

## Règles

### Sécurité
- Jamais de clés API en dur dans le code (utiliser les variables d'environnement)
- RLS (Row Level Security) Supabase activé sur toutes les tables
- Validation côté serveur systématique sur tous les inputs
- Rate limiting sur toutes les routes API publiques

### UI/UX — Charte graphique HIEROS
- **Fond** : noir `#000000`
- **Couleur primaire** : vert néon `#00FF00`
- **Couleur secondaire** : orange `#FF8C00`
- **Style** : terminal militaire / HUD cockpit
- **Bordures** : fines, style cockpit
- **Texte** : majuscules par défaut
- **Logo** : HIEROS en blanc sur fond noir
- **Police contenu** : Courier New (style système/terminal)
- **Police titres** : Marsek (titres et catégories)
- Toute modification UI doit respecter cette charte
