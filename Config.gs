function getScoutnetSyncConfig() {
  return {
    // Base API endpoint URL
    apiUrl: "https://www.scoutnet.se/api/group/customlists",
    
    // Mailing list id
    listId: "",
    
    // API id (Förenings-id, Scoutnet)
    apiId: "",
    
    // Scountnet endpoint API key for list
    apiKey: "",
    
    // G Suite domain
    domain: "example.com",
   
    // E-mail report recipients. Leave empty to disable e-mail reporting.
    reportEmails: [],
    
    // Initial password length
    passwordLength: 10,
    
    // Force user to change password on first login?
    forceChangePassword: true,
    
    // Add new user groups when creating
    // defaultGroups: [ "group1@example.com", "group2@example.com" ]
    defaultGroups: []
        
    // Set to true to perform all actions except actually updating - YOU NEED TO CHANGE THIS!
    dryRun: true,
  };

}