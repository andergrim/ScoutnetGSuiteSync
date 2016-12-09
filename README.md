# ScoutnetGSuiteSync
Google Apps script to add and update Google Apps domain (G Suite) users from Scoutnet

### Vad används scriptet till?
Detta script är till för dig som använder G Suite (Google Apps) för din scoutkår och vill ha möjligheten att lägga till användare och hålla deras uppgifter (namn och e-postadress) uppdaterade från Scoutnet.

Scriptet körs i [Google Apps Script](https://script.google.com) för din domän och kan antingen köras en gång för att göra en massimport av användare, men också via trigger för att t.ex. köras med tidsintervaller.

### Översikt och funktioner
Scriptet har för närvarande följande funktioner. Inget mer är planerat för tillfället, men om du har förslag är det bara att höra av sig. Hör också gärna av dig om du haft användning av scriptet eller om du vill skicka in ändringar du gjort själv.
Det är viktigt att du tittar igenom scriptet, både inställningarna och själva scriptet i sig innan du börjar använda det, så att du får ett hum om ungefär vad det gör innan du börjar använda det. Det finns också saker i själva koden som du kan vilja ändra på, t.ex. hur lösenord och e-postadresser för nya användare genereras.

 * Scriptets grundinställning är att köra s.k "Dry run", dvs inte genomföra några faktiska ändringar utan bara skriva i loggen vad den skulle göra utifrån dina inställningar och din miljö.
 * Import: Användare som inte finns i din G Suite-domän men som finns i din valda Scoutnet-lista skapas. Det finns möjlighet att välja lösenordslängd, krav på att byta lösenord i vid första inloggning och möjlighet till automatiskt tillägg i grupper vid import.
 * Uppdatering: Användare som finns i din domän och som ändrats i Scoutnet (namn och e-postadress) uppdateras i din G Suite-domän.
 * Kör du scriptet manuellt syns en utförlig rapport i loggen (Ctrl+Enter), men du kan också välja att skicka rapport till en eller flera e-postadresser vilket är smidigt om scriptet körs via tidsbaserad trigger.
 * Scriptet uppdaterar inte administratörskonton av säkerhetsskäl.
 * Användare som inte finns i Scoutnet men i domänen berörs inte alls.

### Förutsättningar
Det första du behöver göra för att kunna köra scriptet är att skapa en e-postlista i Scoutnet. Där gör du urvalet, t.ex. alla avdelningsledare, alla medlemmar med roller, osv.
Utöver e-postlista måste Webbkoppling vara påslaget och en API-nyckel genererad för listan i fråga.

G Suite-domänens användare behöver ha en *Custom Attribute*-kategori som heter *Scoutnet* med värdena *Epost* (EMAIL) och *Medlemsnummer* (INTEGER). Du kan såklart lägga till fler än så, men dessa behöver finnas och heta så.
Användare som inte har något medlemsnummer ifyllt i sin användarprofil kommer inte att hittas när scriptet körs, varpå den kommer att försöka skapa ett nytt användarkonto för personen med förmodade namn- och mailadresskonflikter som följd. Det är därför viktigt att förse alla användare (som man vet finns i Scoutnet) med medlemsnummer innan man börjar använda scriptet. Användare som skapas av scriptet får givetvis detta ifyllt automatiskt.

### Instruktioner
1. Gå till https://scripts.google.com, se till att vara inloggad med ett konto som är administratör för domänen
2. Skapa ett nytt projekt och döp det till något lämpligt, t.ex. "ScoutnetSync"
3. Kopiera in innehållet i filerna (*Config.gs* och *ScoutnetSync.gs*) till två nya filer med motsvarande namn
4. Redigera Config.gs och ändra det som behövs. Observera att du måste ändra värdet på variabeln *dryRun* för att något faktiskt ska hända. Du kan lugnt testa inställningar och kopplingen mot Scoutnet utan att vara rädd för att något ska hända så länge *dryRun* är satt till *true*.
5. Markera *ScoutnetSync.gs* och välj att köra funktionen *performScoutnetSync*. När det kör klart man du trycka Ctrl + Enter för att se en loggfil över vad som gjorts (eller skulle ha gjorts om dryRun är påslaget).
