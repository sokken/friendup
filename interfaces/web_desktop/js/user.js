/*©agpl*************************************************************************
*                                                                              *
* This file is part of FRIEND UNIFYING PLATFORM.                               *
* Copyright (c) Friend Software Labs AS. All rights reserved.                  *
*                                                                              *
* Licensed under the Source EULA. Please refer to the copy of the GNU Affero   *
* General Public License, found in the file license_agpl.txt.                  *
*                                                                              *
*****************************************************************************©*/

/*******************************************************************************
*                                                                              *
* User object manages sessions, login and logout                               *
*                                                                              *
*******************************************************************************/

Friend = window.Friend || {};

Friend.User = {
    
    // Vars --------------------------------------------------------------------
    State: 'online', 			// online, offline, login
    serverAvaiable: true,
    Username: '',               // Holds the user's username
    AccessToken: null,          // Holds the user's access token
    ConnectionAttempts: 0,         // How many relogin attempts were made
    
    // Methods -----------------------------------------------------------------
    
    // Log into Friend Core
    Login: function( username, password, remember, callback, event, flags )
    {
    	console.log( 'User.Login', [ username, password, remember, callback, event, flags ])
    	this.State = 'login';
    	if( !event ) 
    		event = window.event;
    	
    	let self = this;
		
		// Close conn here - new login regenerates sessionid
		if( Workspace.conn )
		{
			try
			{
				Workspace.conn.ws.close();
			}
			catch( e )
			{
				console.log( 'Could not close conn.' );
			}
			delete Workspace.conn;
			Workspace.conn = null;
		}
		
		if( username && password )
		{	
			Workspace.encryption.setKeys( username, password );
			
			if( flags && flags.hashedPassword )
			{
				//console.log( 'Sending login with hashed password.' );
				this.SendLoginCall( {
					username: username,
					password: password,
					remember: remember,
					hashedPassword: flags.hashedPassword,
					inviteHash: flags.inviteHash
				}, callback );
			}
			else
			{
				//console.log( 'Sending login with unhashed password' );
				this.SendLoginCall( {
					username: username,
					password: password,
					remember: remember,
					hashedPassword: false,
					inviteHash: flags && flags.inviteHash ? flags.inviteHash : false
				}, callback );
			}
		}
		// Relogin - as we do have an unflushed login
		else if( Workspace.sessionId )
		{
		    return this.ReLogin();
		}
		else
		{
			Workspace.showLoginPrompt();
		}
		
		return 0;
    },
    // Login using a session id
    LoginWithSessionId: function( sessionid, callback, event )
    {
    	console.log( 'LoginWithSessionId', sessionid, callback, event, this.State )
    	if( this.State == 'online' ) 
    		return;
    	
    	this.State = 'login';
    	
    	if( !event ) 
    		event = window.event;
		
		// Close conn here - new login regenerates sessionid
		if( Workspace.conn )
		{
			try
			{
				Workspace.conn.ws.cleanup();
			}
			catch( e )
			{
				console.log( 'Could not close conn.' );
			}
			delete Workspace.conn;
		}
		
		if( sessionid )
		{
			this.SendLoginCall( {
				sessionid: sessionid
			}, callback );
		}
		else
		{
			Workspace.showLoginPrompt();
		}
		
		return 0;
    },
    // Send the actual login call
    SendLoginCall: function( info, callback )
    {	
    	console.trace( 'SendLoginCall', [ info, callback, this.lastLogin ])
    	// Already logging in
    	this.State = 'login';
    	
    	if( this.lastLogin && this.lastLogin.currentRequest )
    	{
    		this.lastLogin.currentRequest.destroy();
    	}
    	
    	let self = this;
    	
    	// Create a new library call object
		let m = new FriendLibrary( 'system' );
		this.lastLogin = m;
		
		if( info.username && info.password )
		{
			Workspace.sessionId = '';
			
			if( window.Workspace && !Workspace.originalLogin )
			{
				Workspace.originalLogin = info.password;
			}
			
			// TODO: Fix hash detector by making sure hashing doesn't occur without hashedPassword flag set.
			let hashDetector = info.password.length > 20 && info.password.substr( 0, 6 ) == 'HASHED' ? true : false;
			if( !info.hashedPassword && hashDetector )
				info.hashedPassword = true;
			
			let hashed = info.hashedPassword ? info.password : ( 'HASHED' + Sha256.hash( info.password ) );
			
			m.addVar( 'username', info.username );
			m.addVar( 'password', hashed );
			
			try
			{
				let enc = parent.Workspace.encryption;
				//console.log( 'Encrypting password into Workspace.loginPassword: ' + info.password );
				parent.Workspace.loginPassword = enc.encrypt( info.password, enc.getKeys().publickey );
				parent.Workspace.loginHashed = hashed;
			}
			catch( e )
			{
				let enc = Workspace.encryption;
				//console.log( 'Encrypting(2) password into Workspace.loginPassword: ' + info.password );
				Workspace.loginPassword = enc.encrypt( info.password, enc.getKeys().publickey );
				Workspace.loginHashed = hashed;
			}
		}
		else if( info.sessionid )
		{
			m.addVar( 'sessionid', info.sessionid );
		}
		else
		{
			this.State = 'offline'; 
			this.lastLogin = null;
			return false;
		}
		
		m.addVar( 'deviceid', GetDeviceId() );
		m.onExecuted = function( json, serveranswer )
		{
			console.log( 'SendLoginCall response', [ json, serveranswer ])
			Friend.User.lastLogin = null;
			// We got a real error
			if( json == null )
			{
				return Friend.User.ReLogin();
			}
			try
			{
				let enc = Workspace.encryption;
				
				if( json.username || json.loginid )
				{
					Workspace.sessionId = json.sessionid;
					if( json.username )
						Workspace.loginUsername = json.username;
					Workspace.loginUserId = json.userid;
					Workspace.loginid = json.loginid;
					Workspace.userLevel = json.level;
					Workspace.fullName = json.fullname;
					
					// If we have inviteHash, verify and add relationship between the inviter and the invitee.
					if( info.inviteHash ) json.inviteHash = info.inviteHash;
					
					// We are now online!
					Friend.User.SetUserConnectionState( 'online' );
					
					if( !Workspace.userWorkspaceInitialized )
					{
                		// Init workspace
						Workspace.initUserWorkspace( json, ( callback && typeof( callback ) == 'function' ? callback( true, serveranswer ) : false ), event );
					}
					else
					{
						if( typeof( callback ) == 'function' )
							callback( true, serveranswer );
						// Make sure we didn't lose websocket!
					}
				
					// Remember login info for next login
					// But removed for security
					// TODO: Figure out a better way!
					if( info.remember )
					{
						// Nothing
					}
				}
				else
				{
					Friend.User.SetUserConnectionState( 'offline' );
					
					if( typeof( callback ) == 'function' ) callback( false, serveranswer );
				}
			}	
			catch( e )
			{
				console.log( 'Failed to understand server response.', e );
				if( callback ) callback( false, serveranswer );
			};
		}
		m.forceHTTP = true;
		m.forceSend = true;
		m.loginCall = true;
		m.execute( 'login' );
    },
	// When session times out, use log in again...
	ReLogin: function( callback )
	{
		console.log( 'ReLogin', {
			callback  : callback,
			lastLogin : this.lastLogin,
			usern     : Workspace.username,
			lusern    : Workspace.loginUsername,
			lpwww     : Workspace.loginPassword,
			sssid     : Workspace.sessionid,
			SSSID     : Workspace.sessionId,
		})
		
    	if( this.lastLogin ) 
    		return false;
    	
    	this.State = 'login';
    	
    	if( !event ) 
    		event = window.event;
    	
    	let self = this;
    	let info = {};
    	
    	if( Workspace.loginUsername && Workspace.loginPassword )
    	{
    		//console.log( 'Trying to log in with: ' + Workspace.loginUsername + ' AND ' + Workspace.loginPassword );
    		
    		info.username = Workspace.loginUsername;
    		let enc = Workspace.encryption;
    		info.password = enc.decrypt( Workspace.loginPassword, enc.getKeys().privatekey );
    		
    		//console.log( 'Unhashed, decrypted password (Workspace.loginPassword): ' + info.password );
    		
    		info.hashedPassword = false;
    	}
    	else if( Workspace.sessionId )
    	{
    		info.sessionid = Workspace.sessionId;
    	}
		
		// Close conn here - new login regenerates sessionid
		if( Workspace.conn )
		{
			try
			{
				Workspace.conn.ws.cleanup();
			}
			catch( e )
			{
				console.log( 'Could not close conn.' );
			}
			delete Workspace.conn;
			Workspace.conn = null;
		}
		
		// Reset cajax http connections (because we lost connection)
		_cajax_http_connections = 0;
		
		console.log( 'ReLogin info', info )
		if( info.username || info.sessionid )
		{
			this.SendLoginCall( info, callback, 'relogin' );
		}
		else
		{
			Workspace.showLoginPrompt();
		}
		
		return 0;
    },
    // Log out
    Logout: function( cbk )
    {
    	console.log( 'User.Logout', cbk )
    	if( !cbk ) 
    		cbk = false;
    	
    	// FIXME: Remove this - it is not used anymore
		window.localStorage.removeItem( 'WorkspaceUsername' );
		window.localStorage.removeItem( 'WorkspacePassword' );
		window.localStorage.removeItem( 'WorkspaceSessionID' );
		Workspace.loginUsername = null;
	    Workspace.loginPassword = null;

		let keys = parent.ApplicationStorage.load( { applicationName : 'Workspace' } );
		if( keys )
		{
			keys.username = '';
			parent.ApplicationStorage.save( keys, { applicationName : 'Workspace' } );
		}

		let dologt = null;
		console.log( 'pre SaveWindowStorage', window.friendApp )
		if ( !window.friendApp ) {
			SaveWindowStorage( afterSaveWinSto )
		} else {
			afterSaveWinSto()
		}
		
		async function afterSaveWinSto()
		{
			console.log( 'afterSaveWinSto', Workspace.logoutURL )
			if( Workspace.logoutURL )
			{
				Workspace.externalLogout();
				return;
			}
			
			await deleteUMA()
			console.log( 'IMA DOME')
			callLogoutUser()
			cleanupWSS()
			exitWorkspace()
			if ( cbk )
				cbk()
		}
		
		function deleteUMA() {
			if ( Workspace.deleteUMAPromise )
				return Workspace.deleteUMAPromise
			
			Workspace.deleteUMAPromise = new Promise(( resolve, reject ) => {
				let ud = new cAjax();
				//ud.open( 'get', '/system.library/mobile/deleteuma/?sessionid=' + Workspace.sessionId + '&token=' + window.Base64alt.encode( friendApp.get_app_token() ) , true );
				ud.open( 'get', '/system.library/mobile/deleteuma/?sessionid=' + Workspace.sessionId + '&token=' + friendApp.get_app_token() , true );
				ud.onload = ( lmdata ) => {
					console.log( 'deleteUMA returned', lmdata )
					delete Workspace.deleteUMAPromise
					resolve()
				}
				//
				ud.forceHTTP = true;
				ud.send();
			})
			return Workspace.deleteUMAPromise
		}
		
		function callLogoutUser() {
			if ( Workspace.logoutUserPromise )
				return Workspace.logoutUserPromise
			
			Workspace.logoutUserPromise = new Promise(( resolve, reject ) => {
				let m = new cAjax();
            	m.open( 'get', '/system.library/user/logout/?sessionid=' + Workspace.sessionId, true );
            	m.forceHTTP = true;
            	m.onload = ( thing, thang ) => {
            		console.log( 'callLogoutUser res', [ thing, thang ])
            		delete Workspace.logoutUserPromise
            	}
            	m.send()
			})
			return Workspace.logoutUserPromise
		}
		
		function cleanupWSS() {
			console.log( 'cleanupWSS' )
			if( Workspace.conn )
			{
				try
				{
					Workspace.conn.ws.close();
				}
				catch( e )
				{
					console.log( 'Could not close conn.' );
				}
				delete Workspace.conn;
				Workspace.conn = null;
			}
			Workspace.sessionId = '';
		}
		
		function exitWorkspace()
		{
			console.trace( 'exitWorkspace' )
			if( window.friendApp )
			{
				friendApp.logout();
				return;
			}
			
			Workspace.sessionId = '';
			document.location.href = window.location.href.split( '?' )[0].split( '#' )[0]; //document.location.reload();
		}
		
		/*
		if( !cbk )
		{
			dologt = setTimeout( exitWorkspace, 750 );
		}
		*/
		return true;
    },
    // Remember keys
    RememberKeys: function()
	{
		if( Workspace.encryption.keys.client )
		{
			ApplicationStorage.save( 
				{
					privatekey : Workspace.encryption.keys.client.privatekey,
					publickey  : Workspace.encryption.keys.client.publickey,
					recoverykey: Workspace.encryption.keys.client.recoverykey
				},
				{
					applicationName: 'Workspace' 
				}
			);
			if( window.ScreenOverlay )
				ScreenOverlay.addDebug( 'Keys remembered' );
			return true;
		}
		return false;
	},
	// Renews session ids for cajax and executes ajax queue!
	RenewAllSessionIds: function( session )
	{
		if( session )
			Workspace.sessionId = session;
		
		// Reset this in this case
		_cajax_http_connections = 0;
		
		Friend.cajax?.forEach( req => req.send())
		Friend.cajax = [];
		
	},
	// Reset the password
	ResetPassword: function( username, callback )
	{
		var passWordResetURL = '/forgotpassword/username/' + encodeURIComponent( username );
		var xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange = function() {
		    if (this.readyState == 4 && this.status == 200) {
		    	if(typeof callback == 'function') callback( this.responseText );
			}
		};
		xhttp.open( 'GET', passWordResetURL, true);
		xhttp.send();
	},
	// Flush previous session
	FlushSession: function()
	{
		// Clear Workspace session
		console.trace( 'flushSession' )
		Workspace.sessionId = '';
	},
	// Initialize this object
	Init: function()
	{
		this.serverAvaiable = true;
	},
	CheckServerNow: function()
	{
		this.CheckServerConnection();
	},
	// Check if the server is alive
	CheckServerConnection: function()
	{
		const self = this
		console.log( 'CheckServerConnection', {
			loginP : Workspace?.loginPrompt,
			state  : Friend.User.State,
			checkInterval : Friend.User.serverCheckInterval,
			check  : Friend.User.serverCheck,
		})
		
		
		if( Workspace?.loginPrompt ) 
			return
		
		if ( Friend.User.serverCheckInterval ) {
			return
		}
		
		if( typeof( Library ) == 'undefined' ) 
			return
		if( typeof( MD5 ) == 'undefined' ) 
			return
		
		/*
		if( Friend.User.serverAvaiable )
		{
			Friend.User.ReLogin();
			return
		}
		*/
		
		Friend.User.serverCheckInterval = setInterval(() =>
		{
			Friend.User.serverCheckTimeout = setTimeout( checkTimeout, 1500 )
			sendCheck()
		}, 2500 );
		
		function checkTimeout() {
			console.log( 'serverCheck timeout')
			Friend.User.serverCheckTimeout = null
			if ( Friend.User.serverCheck?.currentRequest )
				Friend.User.serverCheck.currentRequest.destroy()
			
			Friend.User.serverAvaiable = false
			Friend.User.SetUserConnectionState( 'offline' );
		}
		
		function sendCheck() {
			console.log( 'send server check' )
			let serverCheck = new Library( 'system' );
			Friend.User.serverCheck = serverCheck
			
			serverCheck.forceHTTP = true;
			serverCheck.forceSend = true;
			serverCheck.onExecuted = handleCheckResponse
			serverCheck.execute( 'validate' );
		}
		
		function handleCheckResponse( q, s )
		{
			console.log( 'serverCheck result', [ q, s ])
			if ( null == q && null == s )
				return
			
			if ( null != Friend.User.serverCheckTimeout )
				clearTimeout( Friend.User.serverCheckTimeout )
			
			if ( null != Friend.User.serverCheckInterval )
				clearInterval( Friend.User.serverCheckInterval )
			
			Friend.User.serverCheckTimeout = null
			Friend.User.serverCheckInterval = null
			Friend.User.serverCheck = null
			Friend.User.serverAvaiable = true
			
			// Check missing session
			let missSess = ( s && s.indexOf( 'sessionid or authid parameter is missing' ) > 0 );
			if( !missSess && ( s && s.indexOf( 'User session not found' ) > 0 ) )
				missSess = true;
			if( !missSess && q == null && s == null )
				missSess = true;
	
			if( ( q == 'fail' && !s ) || ( !q && !s ) || ( q == 'error' && !s ) || missSess )
			{
				console.log( 'servercheck - bad response' )
				if( missSess )
				{
					if ( window.friendApp )
						window.friendApp.logout()
					else
						Friend.User.ReLogin()
				}
				Friend.User.SetUserConnectionState( 'offline' );
			}
			else
			{
				console.log( 'servercheck - good response' )
				Friend.User.SetUserConnectionState( 'online', true );
				Friend.User.ConnectionAttempts = 0;
			}
		}; 
		
	
	/*
		try
		{
			// Cancel previous call if it's still in pipe
			if( Friend.User.serverCheck && Friend.User.serverCheck.currentRequest )
			{
				Friend.User.serverCheck.currentRequest.destroy();
			}
			
			Friend.User.serverCheck = serverCheck;
		}
		catch( e )
		{
			console.log( 'servercheck catch ex', e )
			Friend.User.SetUserConnectionState( 'offline' );
		}
		*/
	},
	// Set the user state (offline / online etc)
	SetUserConnectionState: function( mode, force )
	{
		console.log( 'SetUserConnectionState', {
			mode      : mode,
			force     : force,
			currState : this.State,
		})
		
		if ( mode == this.State )
			return
		
		if( mode == 'offline' )
		{
			this.State = 'offline';
			Workspace.workspaceIsDisconnected = true;
			document.body.classList.add( 'Offline' );
			if( Workspace.screen )
				Workspace.screen.displayOfflineMessage();
			Workspace.workspaceIsDisconnected = true;
			if( Workspace.nudgeWorkspacesWidget )
				Workspace.nudgeWorkspacesWidget();
			
			Friend.User.CheckServerConnection()
			
			// Try to close the websocket
			if( Workspace.conn && Workspace.conn.ws )
			{
				try
				{
					Workspace.conn.ws.close();
				}
				catch( e )
				{
					console.log( 'Could not close conn.' );
				}
				if( Workspace.conn && Workspace.conn.ws )
				{
					delete Workspace.conn.ws;
					Workspace.conn.ws = null;
				}
				delete Workspace.conn;
				Workspace.conn = null;
			}
		
			// Remove dirlisting cache!
			if( window.DoorCache )
			{
				DoorCache.dirListing = {};
			}
			
			return
		}
		
		if( mode == 'online' || force || !Workspace.conn )
		{
			this.serverAvaiable = true;
			this.State = 'online';
			document.body.classList.remove( 'Offline' );
			if( Workspace.screen )
				Workspace.screen.hideOfflineMessage();
			
			Workspace.workspaceIsDisconnected = false;
			if( Workspace.nudgeWorkspacesWidget )
				Workspace.nudgeWorkspacesWidget();
			
			// Just remove this by force
			document.body.classList.remove( 'Busy' );
			// Just refresh it
			if( Workspace.refreshDesktop )
				Workspace.refreshDesktop();
			
			// Try to reboot the websocket
			if( !Workspace.conn && Workspace.initWebSocket )
			{
				Workspace.initWebSocket();
			}
			else
			{
				//console.log( 'We have a kind of conn: ', Workspace.conn, Workspace.conn ? Workspace.conn.ws : false );
			}
			
			// Clear execution queue
			_executionQueue = {};
			
			return
		}
		
		console.log( 'SetUserConnectionState mode ????', mode )
		this.State = mode;
		
	}
};
