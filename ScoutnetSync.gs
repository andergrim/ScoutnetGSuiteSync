/**
 * Scoutnet to G Suite sync script, Kristoffer Andergrim <kristoffer@kortedalascoutkar.se>
 */

// Main function
function performScoutnetSync()
{
  // Fetch configuration and build request URI
  var config = getScoutnetSyncConfig();
  var apiUrl = config.apiUrl + '?id=' + config.apiId + '&key=' + config.apiKey + '&list_id=' + config.listId;
  var endTime, startTime;
  
  // Timer
  startTime = new Date();
    
  Logger.log("-- Starting run at %s %s --", startTime, (config.dryRun !== true ? '' : '[DRY RUN!]'));
  
  // Perform request
  Logger.log("Making request to %s", config.apiUrl);
  try {
    var response = UrlFetchApp.fetch(apiUrl);
  } catch(error) {
    endWithError("API call failed with error code: "+ error, config);
    return;
  }
  
  // Check response code
  if (response.getResponseCode() !== 200) {
    endWithError("API call failed with response code "+response.getResponseCode(), config);
    return;
  } else {
    Logger.log("API call successfull");
  }
  
  // Parse response to JSON object
  var membersObject = JSON.parse(response.getContentText("UTF-8"));
  var members = membersObject.data;

  // counters
  var numFetched = 0, numUpdated = 0, numNew = 0, numFailed  = 0, numSkipped = 0;
  
  // Iterate over members object and check each
  // instance against domain users.  
  for (i in members) {
    // Create a new array with values from JSON object
    var member = { 
      "memberId":  members[i].member_no.value,
      "firstName": members[i].first_name.value,
      "lastName":  members[i].last_name.value,
      "email":     members[i].email.value
    };
    
    status = checkAndUpdateMember(member, config);

    // Update counters
    switch (status) {
      case 'new':
        numNew++;
        break;
      
      case 'updated':
        numUpdated++;
        break;
      
      case 'failed':
        numFailed++;
        break;
        
      case 'skipped':
        numSkipped++;
        break;
    }
    numFetched++;
  }
  
  // Successful run, report but don't exit
  Logger.log("Records fetched: %s [ Updated: %s, New: %s, Failed: %s, Skipped: %s ]", numFetched.toString(), numUpdated.toString(), numNew.toString() , numFailed.toString(), numSkipped.toString());
  
  // Log timings and end script
  endTime = new Date();
  runTime = (endTime.getTime() - startTime.getTime()) / 1000;
  Logger.log("-- Ending run at %s (%s seconds) --", endTime, runTime);
  
  endWithSuccess(config);
  return;
}


// Check member against domain users (key = memberId) and 
// perform update or creation of user as applicable.
function checkAndUpdateMember(member, config)
{
  // Sanity checks
  if (!performSanityChecks(member)) return "failed";
  
  // Check for member in G Suite domain
  var user = getUser(member, config);
  
  if (!user) {
    // User does not exist in domain
    Logger.log('No user with Scoutnet id %s (%s %s) found. Creating.', member.memberId, member.firstName, member.lastName);
    
    newUser = createNewUser(member, config);
    if (!newUser) {
      return "fail";
    }
    else {
      return "new";
    }
  } else {
    // User exists in domain
    if (user.isAdmin) {
      // Don't touch admin accounts  
      Logger.log('User %s (%s %s) is an administrator. Skipping.', member.memberId, user.name.givenName, user.name.familyName);
      return "skipped";
    } else {
      // Check if any fields needs updating
      var updateEmail = false, updateGivenName = false, updateFamilyName = false;
      var userSecondaryEmail = getSecondaryEmail(user.emails);
      
      if (member.email !== user.customSchemas.Scoutnet.Epost && member.email !== userSecondaryEmail) updateEmail = true;
      if (member.firstName !== user.name.givenName) updateGivenName = true;
      if (member.lastName !== user.name.familyName) updateFamilyName = true;
      

      if (updateEmail || updateGivenName || updateFamilyName) {
        // Needs update  
        Logger.log('User %s (%s %s) needs updating.', member.memberId, user.name.givenName, user.name.familyName);

        // Assign all update data to array
        var updates = []; // The update patch bodies
        var updateValues = []; // The actual values, for logging
        
        if (updateEmail) {
          updates.push(
            {
              "emails": [
                 {
                   "customType": "",
                   "address": member.email,
                   "type": "custom"
                  }
              ],
              "customSchemas": {
                "Scoutnet": {
                  "Epost": member.email,
                }
              }
            }
          );
          updateValues.push([user.customSchemas.Scoutnet.Epost+"/"+userSecondaryEmail, member.email]);
        }
        
        if (updateGivenName) {
          updates.push(
            {
              "name": {
                "givenName": member.firstName,
              }
            }
          );
          updateValues.push([user.name.givenName, member.firstName]);
        }
        
        if (updateFamilyName) {
          updates.push(
            {
              "name": {
                "familyName": member.lastName,
              }
            }
          );
          updateValues.push([user.name.familyName, member.lastName]);
        }

        // Perform updates
        for (i in updates) {
          Logger.log("  Updating value %s (was %s) %s", updateValues[i][1], updateValues[i][0], (config.dryRun !== true ? '' : '[DRY RUN]'));
          if (config.dryRun !== true) {
            try {
              var userUpdate = AdminDirectory.Users.update(updates[i], user.primaryEmail);
            } catch (error) {
              Logger.log("  Failed updating: %s", error);
              return "failed";
            }
          }
        }
        
        return "updated";
        
      } else {
        Logger.log('User %s (%s %s) is up to date, skipping.', member.memberId, user.name.givenName, user.name.familyName);
        return "skipped";
      }
    }
  }

}


function getUser(member, config)
{
  var userList = AdminDirectory.Users.list({
    customFieldMask: 'Scoutnet',
    domain: config.domain,
    projection: 'custom',
    query: 'Scoutnet.Medlemsnummer='+member.memberId,
    fields: 'users(primaryEmail,customSchemas,emails,id,isAdmin,name(familyName,givenName))'
  });
  
  // Check if user exists in domain
  if (typeof userList.users === 'undefined') {
    return false;
  } else {
    return userList.users[0];
  }
}


// Get secondary email address
function getSecondaryEmail(emails)
{
  for (email in emails) {
    if (emails[email].type === "custom") return emails[email].address;
  }
}


// Perform some basic sanity checks on Scoutnet entry
function performSanityChecks(member)
{
  if (member.memberId == "" || member.memberId < 1) {
    Logger.log('Invalid memberId (id='+member.memberId+')');
    return false;
  }
  
  if (typeof member.firstName !== 'string' || member.firstName.length < 1) {
    Logger.log('Invalid firstName (id='+member.memberId+')');
    return false;
  }
    
  if (typeof member.lastName !== 'string' || member.lastName.length < 1) {
    Logger.log('Invalid lastName (id='+member.memberId+')');
    return false;
  }

  var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (!re.test(member.email)) {
    Logger.log('Invalid email (id='+member.memberId+')');
    return false;
  }
  
  return true;
}


function endWithError(message, config)
{
  Logger.log("** FATAL ERROR: %s", message);
  logText = Logger.getLog();

  for (i in config.reportEmails) {
    var subject = "FAILED ScoutnetSync report";
    MailApp.sendEmail(config.reportEmails[i], subject, logText);
  }
  return;
}


function endWithSuccess(config)
{
  logText = Logger.getLog();
  
  for (i in config.reportEmails) {
    var subject = "Successfull ScoutnetSync report";
    MailApp.sendEmail(config.reportEmails[i], subject, logText);
  }
  
  return;
}


function generateEmailAddress(firstName, lastName, domain)
{
  // Feel free to change these naming schemes to suit your liking and needs.
  // first, first.l, first.last, first.last.2, first.last.3
  var schemes = [
    firstName.toLowerCase(),
    firstName.toLowerCase() + "." + lastName.substring(0, 1).toLowerCase(),
    firstName.toLowerCase() + "." + lastName.toLowerCase(),
    firstName.toLowerCase() + "." + lastName.toLowerCase() + ".2",
    firstName.toLowerCase() + "." + lastName.toLowerCase() + ".3"
  ];
  
  // Try fetching the user and count a failed get as a 
  // success. Slightly unorthodox but more efficient than
  // searching in this case.
  for (i in schemes) {
    var tryAddress = schemes[i]+"@"+domain;

    // Wash the address from characters that might make its way into the generated
    // address based on name. No respect for edge cases, might need tweaking.
    var tryAddress = tryAddress.replace(/[áàâäåæ]/g, 'a')
                               .replace(/[úùûü]/g, 'u')
                               .replace(/[øö]/g, 'o')
                               .replace(/[éëè]/g, 'e')
                               .replace(/[ñ]/g, 'n')
                               .replace(/[^a-z0-9\-_\.\@]/g, '');

    try {
      tryUser = AdminDirectory.Users.get(tryAddress);
      Logger.log("  Address %s is already in use, trying next alternative.", tryAddress);
    } catch (error) {
      Logger.log("  Assigning address %s to new user.", tryAddress);
      return tryAddress;
    }
  }
    
  // All cases in schemes array exhausted, failing.
  return false;
}


function createNewUser(member, config)
{
  // Find an e-mail address for the new user
  var userEmail = generateEmailAddress(member.firstName, member.lastName, config.domain);
  
  if (!userEmail) {
    Logger.log('  Could not assign e-mail address to user.');
    return false;
  }
  
  // Define properties for new user
  var newUser = {
    "primaryEmail": userEmail,
    "name": {
      "givenName": member.firstName,
      "familyName": member.lastName
    },
    "password": getRandomPassword(config.passwordLength),
    "changePasswordAtNextLogin": config.forceChangePassword,
    "emails": [
      {
        "customType": "",
        "address": member.email,
        "type": "custom"
      }
    ],  
    "customSchemas": {
      "Scoutnet": {
        "Epost": member.email,
        "Medlemsnummer": member.memberId
      }
    }
  };
  
 
  // Perform user creation
  if (config.dryRun !== true) {
    // Actually create user
    try {
      user = AdminDirectory.Users.insert(newUser);
    } catch (error) {
      Logger.log("  Could not create new user: %s", error);
      return false;
    }
    Logger.log("  Created new user %s with id (%s)", userEmail, user.id);
  } else {
    // If we're on a dry run
    var user = newUser;      
    Logger.log("  Created new user %s with id (000000000000) [DRY RUN]", userEmail);
  }

  // Add user to groups
  if (config.dryRun !== true) {
    for (i in config.defaultGroups) {
      try {
        var groupMember = {
          email: userEmail,
          role: "MEMBER"
        };
        var membership = AdminDirectory.Members.insert(groupMember, config.defaultGroups[i]);
      } catch (error) {
        Logger.log("  Could not add user to group: %s", error);
        var membersip = false;
      }
      
      if (membership !== false) Logger.log("  Added user to group: %s", config.defaultGroups[i]);
    }
  } else {
    for (i in config.defaultGroups) {
      Logger.log("  Added user to group: %s [DRY RUN]", config.defaultGroups[i]);
    }
  }
  
  return user;
}


function getRandomPassword(length)
{
  var password = "";
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
  for (var i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
