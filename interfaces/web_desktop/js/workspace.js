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
* The FriendUP Desktop Environment interface. For use on workstations and      *
* other places.                                                                *
*                                                                              *
*******************************************************************************/

var _protocol = document.location.href.split( '://' )[0];

window._timings = []
window.addTiming = function( str, obj ) {
	const self = this
	const t = window._timings
	if ( null == t )
		return
	
	const now = Date.now()
	const tims = [ now, str, obj ]
	t.push( tims )
	
	return t
}

window.showTimings = function( timings ) {
	if ( null == timings ) {
		timings = window._timings
		window._timings = null
	}
	
	if ( null == timings )
		return
	
	const s = timings[ 0 ][ 0 ]
	let p = null
	timings.forEach(( tim, i ) => {
		const n = tim[ 0 ]
		const e = n - s
		const str = tim[ 1 ]
		const obj = tim[ 2 ]
		if ( 0 === str.indexOf( '_REQUEST' )) {
			console.log( 'vvvvvvvvvvvvv ' + str, obj )
			window.showTimings( obj )
			console.log( '^^^^^^^^^^^^^' )
			return
		}
		
		let step = 0
		if ( p != null ) {
			step = n - p
		}
		p = n
		
		console.log( '#' + i, {
			'step'  : getS( step ),
			'total' : getS( e ),
			'desc'  : str,
			'data'  : obj,
		})
	})
	
	function getS( ms ) {
		if ( !ms )
			return 0
		
		return ms / 1000
	}
}

Workspace = {
	receivePush: function()
	{
		return false;
	},
	staticBranch: 'Hydrogen 4',
	icons: [],
	menuMode: 'pear', // 'miga', 'fensters' (alternatives) -> other menu behaviours
	mode: 'default',
	theme : 'friendup12',
	initialized: false,
	protocol: _protocol,
	protocolUrl: _protocol + '://',
	menu: [],
	diskNotificationList: [],
	notifications: [],
	notificationEvents: [],
	applications: [],
	importWindow: false,
	menuState: '',
	themeOverride: false,
	systemInfo: false,
	lastfileSystemChangeMessage: false,
	userSettingsLoaded: false, // Tell when user settings loaded
	desktopFirstRefresh: false, // Tell when workspace first refreshed
	serverIsThere: false,
	runLevels: [
		{
			name: 'root',
			domain: _protocol + '://' + document.location.href.match( /h[^:]*?\:\/\/([^/]+)/i )[1]
		},
		{
			name: 'utilities',
			domain: _protocol + '://' + document.location.href.match( /h[^:]*?\:\/\/([^/]+)/i )[1],
			/*domain: 'http://utilities.' + document.location.href.match( /h[^:]*?\:\/\/([^/]+)/i )[1],*/
			listener: apiWrapper
		}
	],
	directoryView: false,
	conn: null,
	pouchManager: null,
	deviceid: GetDeviceId(),

	preinit: function()
	{
		// Go ahead and init!
		ScreenOverlay.init();
		Workspace.init();
		
		if( window.friendApp )
		{
			document.body.classList.add( 'friendapp' );
		}
	},
	init: function()
	{
		
		if( this.initialized )
			return
		
		this.loadAllTheThings();
		
		// Preload some images
		var imgs = [
			'/webclient/gfx/system/offline_16px.png',
			'/themes/friendup12/gfx/busy.png'
		];
		this.imgPreload = [];
		imgs.forEach( src => {
			const i = new Image();
			i.src = src;
			this.imgPreload.push( i );
		});
		
		
		const wImg = new Image()
		Workspace.defaultWallPreload = wImg
		wImg.src = '/webclient/gfx/theme/default_login_screen.jpg'
		Workspace.wallpaperLoadedPromise = new Promise( wallLoaded )
		function wallLoaded( resolve, reject ) {
			wImg.onload = () => {
				resolve()
			}
		}
		
		/*
		for( var a = 0; a < imgs.length; a++ )
		{
			var i = new Image();
			i.src = imgs[a];
			this.imgPreload.push( i );
		}
		*/
		
		// Wait for load
		if( typeof( InitWindowEvents ) == 'undefined' || typeof( InitGuibaseEvents ) == 'undefined' )
		{
			return setTimeout( 'Workspace.init()', 50 );
		}
		
		this.initialized = true;
		
		checkMobileBrowser();
		if( !this.addedMobileCSS && window.isMobile )
		{
			document.body.setAttribute( 'mobile', 'mobile' );
			AddCSSByUrl( '/webclient/css/responsive.css' );
			this.addedMobileCSS = true;
		}
		
		// Show the login prompt if we're not logged in!
		Friend.User.Login();
	},
	
	// Ready after init
	// NB: This is where we go towards workspace_inside.js
	postInit: async function()
	{
		const self = this;
		if( self.postInitialized )
			return;
		
		addTiming( 'postinit' )
		// Everything must be ready
		if( typeof( ge ) == 'undefined' )
		{
			throw new Error( 'wheres ge()=?' )
			/*
			if( this.initTimeout )
				clearTimeout( this.initTimeout );
			this.initTimeout = setTimeout ( 'Workspace.postInit()', 25 );
			return;
			*/
		}
		
		// We passed!
		self.postInitialized = true;
		
		if( this.loginPrompt )
			this.loginPrompt.setFlag( 'hidden', 1 );

		// Do the init!
		window.addEventListener( 'beforeunload', Workspace.leave, true );

		InitWindowEvents();
		InitWorkspaceEvents();
		InitGuibaseEvents();

		let dapis = document.createElement( 'script' );
		dapis.src = '/system.library/module/?module=system&command=doorsupport&sessionid=' + this.sessionId;
		document.getElementsByTagName( 'head' )[0].appendChild( dapis );

		// Add event listeners
		for( let a = 0; a < this.runLevels.length; a++ )
		{
			let listener = this.runLevels[a].listener;

			if ( !listener )
				continue;

			if( window.addEventListener )
				window.addEventListener( 'message', listener, true );
			else window.attachEvent( 'onmessage', listener, true );
		}

		// Set base url
		this.baseUrl = document.location.href.split( 'index.html' )[0];

		// Setup default Doors screen
		let wbscreen = new Screen( {
			title: 'Friend Workspace',
			id:	'DoorsScreen',
			extra: Workspace.fullName,
			taskbar: true,
			scrolling: false
		} );

		// Make links to screen on this object
		this.screen = wbscreen;
		this.screenDiv = wbscreen.div;
		
		let tray = document.createElement( 'div' );
		tray.id = 'Tray';
		this.screenDiv.appendChild( tray );

		// Init the deepest field
		if( !isMobile )
			DeepestField.init();
		else 
			DeepestField = false;

		// Key grabber
		if( !ge( 'InputGrabber' ) )
		{
			let i = document.createElement( 'input' );
			i.type = 'text';
			i.id = 'InputGrabber';
			i.style.position = 'absolute';
			i.style.left = '-1000px';
			i.style.pointerEvents = 'none';
			ge( 'DoorsScreen' ).appendChild( i );
		}

		wbscreen.div.addEventListener( 'mousedown', function( e )
		{
			let wd = wbscreen.div.screenTitle.getElementsByClassName( 'Extra' )[0].widget;
			if( wd )
			{
				if( wd.shown )
				{
					wd.hideWidget();
				}
			}
		} );

		// Widget for various cool facts!
		wbscreen.div.screenTitle.getElementsByClassName( 'Extra' )[0].onmouseover = function( e )
		{
			this.classList.add( 'Hover' );
		}
		wbscreen.div.screenTitle.getElementsByClassName( 'Extra' )[0].onmouseout = function( e )
		{
			this.classList.remove( 'Hover' );
		}

		// In desktop mode, show the calendar
		if( !window.isMobile )
		{
			let ex = wbscreen.div.screenTitle.getElementsByClassName( 'Extra' )[0];
			Workspace.calendarClickEvent = function( e )
			{
				if( !ex.widget )
				{
					o = {
						width: 400,
						height: 300,
						top: Workspace.screen.contentDiv.offsetTop,
						halign: 'right',
						scrolling: false,
						autosize: true
					};
					ex.widget = new Widget( o );
					ex.widget.dom.style.transition = 'height 0.25s';
					ex.widget.showWidget = function()
					{
						let sself = this;
						this.dom.style.height = '0px';
						Workspace.refreshExtraWidgetContents();
						CoverScreens();
						ge( 'DoorsScreen' ).classList.add( 'HasWidget' );
						setTimeout( function()
						{
							sself.show();
							sself.raise();
							ExposeScreens();
						}, 100 );
					}
					ex.widget.hideWidget = function()
					{
						let sself = this;
						ge( 'DoorsScreen' ).classList.add( 'HidingCalendar' );
						setTimeout( function()
						{
							ge( 'DoorsScreen' ).classList.remove( 'HasWidget' );
							ge( 'DoorsScreen' ).classList.remove( 'HidingCalendar' );
							sself.shown = false;
							sself.hide();
							sself.lower();
							ExposeScreens();
						}, 250 );
					}
				}
				if( !ex.widget.shown )
					ex.widget.showWidget();
				else ex.widget.hide();
				return cancelBubble( e );
			}
			ex.onclick = Workspace.calendarClickEvent;
			ex.classList.add( 'MousePointer' );
			ex.onmousedown = function( e )
			{
				return cancelBubble( e );
			}
			ex.onmouseup = function( e )
			{
				return cancelBubble( e );
			}
		}

		// Setup clock
		if( !isMobile )
		{
			let ex = ge( 'DoorsScreen' ).screenObject._titleBar;
			ex = ex.getElementsByClassName( 'Extra' )[0];
			function clock()
			{
				let d = new Date();
				if( !ex.time )
				{
					let t = document.createElement( 'div' );
					t.className = 'Time';
					ex.appendChild( t );
					ex.time = t;
				}
				if( !Friend.User.serverAvaiable )
				{
					if( !ex.offline )
					{
						let o = document.createElement( 'div' );
						o.className = 'Offline';
						o.innerHTML = i18n( 'i18n_ws_disconnected' );
						if( ex.time )
						{
							ex.insertBefore( o, ex.time );
						}
						else
						{
							ex.appendChild( o );
						}
						ex.offline = o;
					}
				}
				else if( ex.offline )
				{
					ex.removeChild( ex.offline );
					ex.offline = null;
				}

				// Set the clock
				let e = '';
				e +=    StrPad( d.getHours(), 2, '0' ) + ':' +
						   StrPad( d.getMinutes(), 2, '0' ); /* + ':' +
						   StrPad( d.getSeconds(), 2, '0' );*/
				/*e +=    ' ' + StrPad( d.getDate(), 2, '0' ) + '/' +
						   StrPad( d.getMonth() + 1, 2, '0' ) + '/' + d.getFullYear();*/
				ex.time.innerHTML = e;

				// Realign workspaces
				Workspace.nudgeWorkspacesWidget();
				Workspace.refreshExtraWidgetContents(); // < Screenbar icons
			}
			this.clockInterval = setInterval( clock, 1000 );
		}
		
		// Start the workspace session!
		this.initializingWorkspaces = true
		await this.initWorkspaces()
		addTiming( 'initWorkspaces done' )
		await doSomeMoreThingsWhoKnows()
		// Init security subdomains
		//SubSubDomains.initSubSubDomains();
		this.initializingWorkspaces = false
		//self.setLoading( false )
		addTiming( 'postinit completed' )
		
		
		async function doSomeMoreThingsWhoKnows()
		{
			// Recall wallpaper from settings
			//await self.refreshUserSettings()
			const mountList = await Workspace.refreshDesktop( null, true );
			
			// Create desktop
			self.directoryView = new DirectoryView( wbscreen.contentDiv );

			// Create default desklet
			let mainDesklet = CreateDesklet( self.screenDiv, 64, 480, 'right' );

			// Add desklet to dock
			self.mainDock = mainDesklet;
			if( !isMobile )
			{
				self.mainDock.dom.oncontextmenu = function( e )
				{
					let tar = e.target ? e.target : e.srcElement;
					if( tar.classList && tar.classList.contains( 'Task' ) )
					{
						return Workspace.showContextMenu( false, e );
					}

					let men = [
						{
							name: i18n( 'i18n_edit_dock' ),
							command: function()
							{
								ExecuteApplication( 'Dock' );
							}
						}
					];

					if( tar.classList && tar.classList.contains( 'Launcher' ) )
					{
						men.push( {
							name: i18n( 'i18n_remove_from_dock' ),
							command: function()
							{
								Workspace.removeFromDock( tar.executable );
							}
						} );
					}
				
					if( movableWindowCount > 0 )
					{
						men.push( {
							name: i18n( 'i18n_minimize_all_windows' ),
							command: function( e )
							{
								let t = GetTaskbarElement();
								let lW = null;
								for( let a = 0; a < t.childNodes.length; a++ )
								{
									if( t.childNodes[a].view && !t.childNodes[a].view.parentNode.getAttribute( 'minimized' ) )
									{
										t.childNodes[a].view.parentNode.setAttribute( 'minimized', 'minimized' );
									}
								}
								_DeactivateWindows();
							}
						} );
						men.push( {
							name: i18n( 'i18n_show_all_windows' ),
							command: function( e )
							{
								let t = GetTaskbarElement();
								for( let a = 0; a < t.childNodes.length; a++ )
								{
									if( t.childNodes[a].view && t.childNodes[a].view.parentNode.getAttribute( 'minimized' ) == 'minimized' )
									{
										t.childNodes[a].view.parentNode.removeAttribute( 'minimized' );
									}
								}
								_ActivateWindow( t.childNodes[t.childNodes.length-1].view );
							}
						} );
					}

					Workspace.showContextMenu( men, e );
				}
			}
			// For mobiles
			else
			{
				self.mainDock.dom.oncontextmenu = function( e )
				{
					let tar = e.target ? e.target : e.srcElement;
					if( window.MobileContextMenu )
					{
						MobileContextMenu.show( tar );
					}
				}
			}
			
			self.reloadDocks();
		}
	},
	setLoading: function( isLoading )
	{
		const self = this
		console.log( 'Workspace.setLoading', {
			isLoading   : isLoading,
			initWrkSpcs : this.initializingWorkspaces,
		})
		if( isLoading )
		{
			document.body.classList.add( 'Loading' );
		}
		else
		{
			if( !this.initializingWorkspaces )
			{
				document.body.classList.add( 'Inside' ); // If not exists
				document.body.classList.add( 'Loaded' );
				document.body.classList.remove( 'Login' ); // If exists
				document.body.classList.remove( 'Loading' );
			}
		}
	},
	// Just a stub - this isn't used anymore
	rememberKeys: function() {
		return false;
	},
	encryption: {

		fcrypt: fcrypt,
		keyobject: false,
		encoded: true,

		keys: {
			client: false,
			server: false
		},

		setKeys: function( u, p )
		{
			console.log( 'encryption.setKeys called' )
			if( typeof( this.fcrypt ) != 'undefined' )
			{
				if( u && !Workspace.loginUsername ) Workspace.loginUsername = u;
				
				p = ( !p || p.indexOf('HASHED') == 0 ? p : ( 'HASHED' + Sha256.hash( p ) ) );

				if( window.ScreenOverlay )
					ScreenOverlay.addDebug( 'Generating sha256 keys' );

				var seed = ( u && p ? this.fcrypt.generateKey( ( u + ':' + p ), 32, 256, 'sha256' ) : false );

				var keys = ApplicationStorage.load( { applicationName : 'Workspace' } );

				if( !keys || ( keys && !keys.privatekey ) || ( keys && seed && keys.recoverykey != seed ) )
				{
					if( window.ScreenOverlay )
						ScreenOverlay.addDebug( 'Generating encryption keys' );
					this.keyobject = this.fcrypt.generateKeys( false, false, false, seed );
					keys = this.fcrypt.getKeys( this.keyobject );
				}
				else
				{
					if( window.ScreenOverlay )
					{
						ScreenOverlay.addDebug( 'Loaded encryption keys' );
					}
				}

				if( keys )
				{
					if( this.encoded )
					{
						this.keys.client = {
							privatekey  : this.fcrypt.encodeKeyHeader( keys.privatekey ),
							publickey   : this.fcrypt.encodeKeyHeader( keys.publickey ),
							recoverykey : keys.recoverykey
						};
						if( window.ScreenOverlay )
							ScreenOverlay.addDebug( 'Keys stored encoded' );
					}
					else
					{
						this.keys.client = {
							privatekey  : keys.privatekey,
							publickey   : keys.publickey,
							recoverykey : keys.recoverykey
						};
						if( window.ScreenOverlay )
							ScreenOverlay.addDebug( 'Keys stored raw' );
					}
				}
				return this.keys;
			}

			return false;
		},
		generateKeys: function( u, p )
		{
			console.trace( 'encryption.generateKeys called' )
			if( typeof( this.fcrypt ) != 'undefined' )
			{
				if( window.ScreenOverlay )
					ScreenOverlay.addDebug( 'Generating keys' );
				
				var pass = ( u && p ? u + ':' : '' ) + ( p ? p : '' );

				var keyobject = this.fcrypt.generateKeys( pass );

				var keys = this.fcrypt.getKeys( keyobject );

				if( keys )
				{
					if( this.encoded )
					{
						return {
							privatekey  : this.fcrypt.encodeKeyHeader( keys.privatekey ),
							publickey   : this.fcrypt.encodeKeyHeader( keys.publickey ),
							recoverykey : keys.recoverykey
						};
					}
					else
					{
						return {
							privatekey  : keys.privatekey,
							publickey   : keys.publickey,
							recoverykey : keys.recoverykey
						};
					}
				}
			}

			return false;
		},
		getKeys: function()
		{
			if( typeof( this.fcrypt ) != 'undefined' && this.keys.client )
			{
				if( this.encoded )
				{
					return {
						privatekey  : this.fcrypt.encodeKeyHeader( this.keys.client.privatekey ),
						publickey   : this.fcrypt.encodeKeyHeader( this.keys.client.publickey ),
						recoverykey : this.keys.client.recoverykey
					};
				}
				else
				{
					return {
						privatekey  : this.fcrypt.decodeKeyHeader( this.keys.client.privatekey ),
						publickey   : this.fcrypt.decodeKeyHeader( this.keys.client.publickey ),
						recoverykey : this.keys.client.recoverykey
					};
				}
			}

			return false;
		},
		getServerKey: function( callback )
		{
			var k = new Module( 'system' );
			k.onExecuted = function( e, d )
			{
				if( callback )
				{
					if( e == 'ok' && d )
					{
						callback( d );
					}
					else
					{
						callback( false );
					}
				}
			}
			k.execute( 'getserverkey' );
		},
		encryptRSA: function( str, publickey )
		{
			if( typeof( this.fcrypt ) != 'undefined' )
			{
				return this.fcrypt.encryptRSA( str, ( publickey ? publickey : this.keys.client.publickey ) );
			}

			return false;
		},
		decryptRSA: function( cipher, privatekey )
		{
			if( typeof( this.fcrypt ) != 'undefined' )
			{
				return this.fcrypt.decryptRSA( cipher, ( privatekey ? privatekey : this.keys.client.privatekey ) );
			}

			return false;
		},
		encryptAES: function( str, publickey )
		{
			if( typeof( this.fcrypt ) != 'undefined' )
			{
				return this.fcrypt.encryptAES( str, ( publickey ? publickey : this.keys.client.publickey ) );
			}

			return false;
		},
		decryptAES: function( cipher, privatekey )
		{
			if( typeof( this.fcrypt ) != 'undefined' )
			{
				return this.fcrypt.decryptAES( cipher, ( privatekey ? privatekey : this.keys.client.privatekey ) );
			}

			return false;
		},
		encrypt: function( str, publickey )
		{
			if( typeof( this.fcrypt ) != 'undefined' )
			{
				var encrypted = this.fcrypt.encryptString( str, ( publickey ? publickey : this.keys.client.publickey ) );

				if( encrypted && encrypted.cipher )
				{
					return encrypted.cipher;
				}
			}

			return false;
		},
		decrypt: function( cipher, privatekey )
		{
			if( typeof( this.fcrypt ) != 'undefined' )
			{
				var decrypted = this.fcrypt.decryptString( cipher, ( privatekey ? privatekey : this.keys.client.privatekey ) );

				if( decrypted && decrypted.plaintext )
				{
					return decrypted.plaintext;
				}
			}

			return false;
		},
		sha256: function( str )
		{
			if( !str && typeof( this.fcrypt ) != 'undefined' )
			{
				return this.fcrypt.generateKey( '', 32, 256, 'sha256' );
			}

			if( typeof( Sha256 ) != 'undefined' )
			{
				return Sha256.hash( str );
			}

			return false;
		},
		md5: function( str )
		{
			if( !str && typeof( this.fcrypt ) != 'undefined' )
			{
				return MD5( this.fcrypt.generateKey( '', 32, 256, 'sha256' ) );
			}

			if( typeof( MD5 ) != 'undefined' )
			{
				return MD5( str );
			}

			return false;
		}
	},
	exitMobileMenu: function()
	{
		document.body.classList.remove( 'WorkspaceMenuOpen' );
		if( ge( 'WorkspaceMenu' ) )
		{
			var eles = ge( 'WorkspaceMenu' ).getElementsByTagName( '*' );
			for( var z = 0; z < eles.length; z++ )
			{
				if( eles[z].classList && eles[z].classList.contains( 'Open' ) )
					eles[z].classList.remove( 'Open' );
			}
			ge( 'WorkspaceMenu' ).classList.remove( 'Open' );
			if( WorkspaceMenu.back )
			{
				WorkspaceMenu.back.parentNode.removeChild( WorkspaceMenu.back );
				WorkspaceMenu.back = null;
			}
		}
	},
	showLoginPrompt: function()
	{
		console.trace( 'showLoginPrompt', Workspace.loginPrompt )
		if ( Workspace.loginPrompt ) {
			Workspace.loginPrompt.activate();
			return
		}
		
		// No loginprompt when we are inside
		if( document.body.classList.contains( 'Inside' ) )
			return;
			
		// Enable friend book mode
		if( document.body.getAttribute( 'friendbook' ) == 'true' )
			window.friendBook = true;

		// Set body to login state
		document.body.className = 'Login';
		if( Workspace.interfaceMode && Workspace.interfaceMode == 'native' )
			return;
		
		// Allowed hash vars we can send to loginpromt
		function allowedHashVars()
		{
			let vars = []; let hash = {};
			
			if( window.location.hash && window.location.hash.split( '#' )[1] )
			{
				let allowed = [ 'module', 'verify', 'invite' ];
				
				let url = window.location.hash.split( '#' )[1].split( '&' );
				
				for( let a in url )
				{
					if( url[ a ].indexOf( '=' ) >= 0 && url[ a ].split( '=' )[ 0 ] )
					{
						hash[ url[ a ].split( '=' )[ 0 ] ] = url[ a ].replace( url[ a ].split( '=' )[ 0 ] + '=', '' );
					}
				}
				
				for( let b in allowed )
				{
					if( allowed[ b ] in hash )
					{
						vars.push( allowed[ b ] + '=' + hash[ allowed[ b ] ] );
					}
				}
				
				// Remove the hash values from the url after
				window.location.hash = '';
			}
			
			return ( vars.length > 0 ? ( '?' + vars.join( '&' ) ) : '' );
		}
		
		let lp = new View( {
			id: 'Login',
			width: 432,
			'min-width': 290,
			'max-width': 432,
			height: 480,
			'min-height': 280,
			'resize': false,
			title: 'Login to Friend OS',
			close: false,
			login: true,
			theme: 'login'
		} );
		lp.limitless = true;
		lp.onMessage = function( msg )
		{
			if( msg && msg.type && msg.src && msg.action == 'openWindow' )
			{
				switch( msg.type )
				{
					
					case 'eula':
					{
						let v = new View( {
							title: 'LoginPopup',
							width: 432,
							height: 480,
							resize: false
						} );
						
						let f = new XMLHttpRequest();
						f.open( 'POST', '/webclient/templates/EULA.html', true, true );
						f.onload = function()
						{
							let t = this.responseText + '';
							t += '<hr class="Divider"/>\
								<div class="ContractAcceptReject">\
									<button type="button" class="IconSmall fa-remove" onclick="CloseView()"> Close</button>\
								</div>';
							v.setContent( t );
						}
						f.send();
					}
					break;
						
					case 'privacypolicy':
					{
						let v = new View( {
							title: 'LoginPopup',
							width: 432,
							height: 480,
							resize: false
						} );
						
						let f = new XMLHttpRequest();
						f.open( 'POST', '/webclient/templates/PrivacyPolicy.html', true, true );
						f.onload = function()
						{
							let t = this.responseText + '';
							t += '<hr class="Divider"/>\
								<div class="ContractAcceptReject">\
									<button type="button"  class="IconSmall fa-remove" onclick="CloseView()"> Close</button>\
								</div>';
							v.setContent( t );
						}
						f.send();
					}
					break;
					
				}
			}
		}
		lp.setRichContentUrl( '/loginprompt' + allowedHashVars() );
		Workspace.loginPrompt = lp;

		// Show it
		this.showDesktop();
	},
	flushSession: function()
	{
		Friend.User.FlushSession();
	},
	login: function( u, p, r, callback, ev )
	{
		// Use authmodule login
		if( Workspace.authModuleLogin )
		{
			return Workspace.authModuleLogin( callback, window );
		}
		// Wrap to user object
		return Friend.User.Login( u, p, r, callback, ev );
	},
	// TODO: This function should never be used!
	loginSessionId: function( sessionid, callback, ev )
	{
		return Friend.User.LoginWithSessionId( sessionid, callback, ev );
	},
	showDesktop: function()
	{
		// View desktop
		// May be deprecated
	},
	// Stubs
	leave: function()
	{
	},
	doLeave: function()
	{
	},
	setInCache( type, data ) {
		const app = {
			applicationName : 'cache',
		}
		let cache = ApplicationStorage.load( app )
		if ( null == cache )
			cache = {}
		
		cache[ type ] = data
		ApplicationStorage.save( cache, app )
	},
	getFromCache( type ) {
		const app = {
			applicationName : 'cache',
		}
		const cache = ApplicationStorage.load( app )
		const data = cache[ type ]
		console.log( 'getFromCache', [ type, !!data ])
		return cache[ type ] || null
	},
	sendLoginRequest : function( loginReq ) {
		console.log( 'Workspace.sendLoginRequest', loginReq )
		loginReq.send()
		if ( !window.friendApp )
			return
		
		// hides login for mobile devices
		Workspace.loginPrompt.content.parentNode.style.opacity = 0
		Workspace.setLoading( true )
		
	},
	initUserWorkspace: async function( json, not_a_callback, ev )
	{
		window.addTiming( 'initUserWorkspace' );
		console.log( 'initUserWorkspace', { 
			ev   : ev, 
			json : json, 
			not_all_callback : not_a_callback, 
			userWorkspaceInitialized : Workspace.userWorkspaceInitialized, 
		})
		
		if( Workspace.loginPrompt )
		{
			Workspace.loginPrompt.content.parentNode.style.opacity = 0
			Workspace.loginPrompt.close();
			Workspace.loginPrompt = false;
		}
		
		if ( Workspace.userWorkspaceInitialized && window.ScreenOverlay ) {
			window.ScreenOverlay.hide();
		}
		
		await UWInit()
		
		return true;
		
		async function UWInit()
		{
			const _this = Workspace
			
			if ( null == _this.userWorkspaceInitialized )
				ScreenOverlay.show();
			
			await WorkspaceInside.setThemeStyle()
			
			loadLocale()
			Workspace.loadThemeCss()
			Workspace.loadSystemInfo()
			Workspace.loadUserSettings()
			WorkspaceInside.loadMountList()
			WorkspaceInside.loadDosDriverTypes()
			WorkspaceInside.loadServerConfig()
			WorkspaceInside.loadDosDriverTypes()
			//WorkspaceInside.loadGeneralSettings() refreshUserSettings will trigger this earlier
			WorkspaceInside.refreshUserSettings()
			
			// Manipulate screen overlay
			// (this will only be shown once!)
			// TODO: Figure out if this is the right behavior in every case
			//       implementation circumvents relogin issue
			/*
			if( !Workspace.screenOverlayShown )
			{
				ScreenOverlay.show();
				Workspace.screenOverlayShown = true;
			}
			*/
			console.log( 'UWInit()', {
				thiss     : _this.userWorkspaceInitialized,
				Workspace : Workspace.userWorkspaceInitialized,
				wWspc     : window.Workspace.userWorkspaceInitialized,
			})
			
			if( _this.userWorkspaceInitialized )
			{
				await SetupWorkspaceData( json )
				document.body.classList.remove( 'Login' );
				document.body.classList.add( 'Inside' );
				
				return 1;
			}
			else {
				_this.userWorkspaceInitialized = true;
				
				/*
				const skripts = await this.loadManySkripts();
				
				let s = document.createElement( 'script' );
				s.innerHTML = skripts;
				document.body.appendChild( s );
				*/
				
				//s.onload = function()
				//{
				    // Start with expanding the workspace object
					// TODO: If we have sessionid - verify it through ajax.
					// TODO: This block is only for already initialized workspace
				if( _this.sessionId && _this.postInitialized )
				{
					if( callback && typeof( callback ) == 'function' ) 
						callback( true );
					
					return true;
				}
				
				if( !json || !json.sessionid ) 
				{
					return false;
				}
				
				InitWorkspaceNetwork();
				
				// Reset some options
				if( ev && ev.shiftKey )
				{
					_this.themeOverride = 'friendup12'
				}
				
				if( GetUrlVar( 'interface' ) )
				{
					switch( GetUrlVar( 'interface' ) )
					{
						case 'native':
							_this.interfaceMode = 'native';
							break;
						default:
							break;
					}
				}
				
				if( GetUrlVar( 'noleavealert' ) )
				{
					_this.noLeaveAlert = true;
				}
				
				await SetupWorkspaceData( json );
				
				if( !_this.workspaceHasLoadedOnceBefore )
				{
					_this.workspaceHasLoadedOnceBefore = true;
				}
				
				// Lets load the stored window positions!
				LoadWindowStorage();
				
				// Set up a shell instance for the workspace
				let uid = FriendDOS.addSession( _this );
				_this.shell = FriendDOS.getSession( uid );
				
				// We're getting the theme set in an url var
				let th = '';
				if( ( th = GetUrlVar( 'theme' ) ) )
				{
					_this.refreshTheme( th, false );
					if( _this.loginPrompt )
					{
						_this.loginPrompt.close();
						_this.loginPrompt = false;
					}
					_this.init();
				}
				// See if we have some theme settings
				else
				{
					checkELUA()
					checkUserSettings()
					checkInvite( json )
				}
				
				Workspace.postInit()
				
				return 1;
			}
		}
		
		function loadLocale( cache )
		{
			const _this = Workspace;
			if ( Workspace.loadLocalePromise )
				return Workspace.loadLocalePromise
			
			Workspace.loadLocalePromise = new Promise( load )
			return Workspace.loadLocalePromise
			
			function load( resolve, reject ) {
				// Language
				addTiming( 'loadLocale' );
				const cache = _this.getFromCache( 'settings' )
				if ( null != cache ) {
					handle( cache )
					delete self.loadLocalePromise
					resolve()
					return
				}
				
				_this.locale = 'en';
				let l = new Module( 'system' );
				l.onExecuted = ( e, d ) => {
					if ( e != 'ok' ) {
						Workspace.friendVersion = false
						i18nAddPath( 'locale/en.locale' )
						delete self.loadLocalePromise
						resolve()
						return
					}
					
					let settings = null;
					try
					{
						settings = JSON.parse( d );
					}
					catch( ex )
					{
						console.log( 'loadLocale json error', [ e, d, ex ])
					}
					
					_this.setInCache( 'settings', settings )
					handle( settings )
					delete self.loadLocalePromise
					resolve()
				}
				
				function handle( settings )
				{
					// New translations
					i18n_translations = [];
					
					// Add it!
					i18nClearLocale();
					
					if( null != settings.locale )
						_this.locale = settings.locale;
						
					//load english first and overwrite with localised values afterwards :)
					i18nAddPath( 'locale/en.locale', function(){
						if( _this.locale != 'en' ) 
							i18nAddPath( 'locale/' + _this.locale + '.locale' );
					});
					
					try
					{
						if( settings.response == 'Failed to load user.' )
						{
							_this.logout();
						}
					}
					catch( e ){};
					
					// Current stored Friend version
					if( null == settings.friendversion )
					{
						Workspace.friendVersion = false;
					}
					else
					{
						Workspace.friendVersion = settings.friendversion;
					}
					
					addTiming( 'loadLocale complete' );
				}
				
				l.execute( 'getsetting', { settings: [ 'locale', 'friendversion' ] } );
				
			}
		}
				
		function checkELUA() {
			if ( Workspace.eluaPromise )
				return Workspace.eluaPromise
			
			Workspace.eluaPromise = new Promise( check )
			return Workspace.eluaPromise
			
			function check( resolve, reject ) {
				let m = new Module( 'system' );
				m.onExecuted = function( ee, dd )
				{
			        if( ee != 'ok' )
			        {
			        	if( dd )
			        	{
			        		try
			        		{
			        			let js = JSON.parse( dd );
			        			if( js.euladocument )
			        			{
			        				Workspace.euladocument = js.euladocument;
			        			}
			        		}
			        		catch( e ){};
			        	}
			            ShowEula()
					}
					
					delete Workspace.eluaPromise
					resolve()
				}
				m.execute( 'checkeula' );
			}
		}
		
		function checkInvite( json ) {
			/*
					if( json.inviteHash )
					{
						let inv = new Module( 'system' );
						inv.onExecuted = function( err, dat )
						{
							// TODO: Make some better error handling ...
							if( err != 'ok' ) 
								console.log( '[ERROR] verifyinvite: ' + ( dat ? dat : err ) );
						}
						inv.execute( 'verifyinvite', { hash: json.inviteHash } );
					}
					*/
					
		}
		
		async function checkUserSettings() {
			const us = await Workspace.getUserSettings()
			if ( !us )
				return
			
			if ( us?.Mimetypes )
				Workspace.mimeTypes = us.Mimetypes;
			
			let themeName = null
			if( us?.Theme?.length )
				themeName = us.Theme.toLowerCase()
			
			if ( themeName )
				Workspace.refreshTheme( themeName, false );
			else
				Workspace.refreshTheme( false, false );
		}
		
		async function SetupWorkspaceData( json )
		{
			const _this = Workspace;
			console.log( 'SetupWorkspaceData', json )
			// Ok, we're in
			_this.sessionId = json.sessionid ? json.sessionid : null;
			_this.userId    = json.userid;
			_this.fullName  = json.fullname;
			_this.fc_token  = json.token
			if( json.username ) 
				_this.loginUsername = json.username;
			
			// After a user has logged in we want to prepare the workspace for him.
			
			// Store user data in localstorage for later verification encrypted
			let userdata = ApplicationStorage.load( { applicationName : 'Workspace' } );
			
			if( userdata )
			{
				userdata.sessionId     = _this.sessionId;
				userdata.userId        = _this.userId;
				userdata.loginUsername = _this.loginUsername;
				userdata.fullName      = _this.fullName;

				ApplicationStorage.save( userdata, { applicationName : 'Workspace' } );
			}
			
			// Only renew session..
			if( ge( 'SessionBlock' ) )
			{
				// Could be many
				while( ge( 'SessionBlock' ) )
				{
					document.body.removeChild( ge( 'SessionBlock' ) );
				}
				// console.log( 'Test2: Renewing all sessions.' );
				
				// We have renewed our session, make sure to set it and run ajax queue
				Friend.User.RenewAllSessionIds( _this.sessionId );
				
				return;
			}
			
			// Set server key
			// TODO: Find a better place to set server publickey earlier in the process, temporary ... again time restraints makes delivery fast and sloppy ...
			/*
			if( !_this.encryption.keys.server )
			{
				_this.encryption.getServerKey( function( server )
				{
					_this.encryption.keys.server = ( server ? { publickey: server } : false );
				} );
			}
			*/
			// Make sure we have a public key for this user (depending on login interface)
			// TODO: See if we actually need this (and it doesn't work properly)
			/*if( window.friendApp )
			{
				var credentials = friendApp.getCredentials();
				var info = Workspace.generateKeys( credentials.username, credentials.password );
				var m = new Module( 'system' );
				m.onExecuted = function( e, d )
				{
					// Call back!
					if( cb ) cb();
				}
				m.execute( 'setuserpublickey', { publickey: info.publickey } );
				return;
			}*/
			
			
		}
		
	},
	
	getUserSettings : async function() {
		const self = this
		if ( Workspace.userSettings )
			return Workspace.userSettings
		
		await self.loadUserSettings()
		return Workspace.userSettings
	},
	loadUserSettings : function() {
		const self = this
		if ( self.loadUserSettingsPromise )
			return self.loadUserSettingsPromise
		
		self.loadUserSettingsPromise = new Promise( load )
		return self.loadUserSettingsPromise
		
		function load( resolve, reject ) {
			Workspace.userSettings = null
			const _this = Workspace;
			let m = new Module( 'system' );
			m.onExecuted = handleUserSettings
			m.execute( 'usersettings' )
			
			function handleUserSettings( e, d )
			{	
				if ( 'ok' != e ) {
					done()
					return;
				}
				
				let us = null
				try
				{
					us = JSON.parse( d );
				}
				catch( ex )	{ };
				Workspace.userSettings = us
				
				done()
			}
			
			function done() {
				delete Workspace.loadUserSettingsPromise
				resolve()
			}
		}
	},
	//set an additional URL to call on logout
	setLogoutURL: function( logoutURL )
	{
		if( logoutURL )
			Workspace.logoutURL = logoutURL;
	},
	loadAllTheThings : async function() {
		if ( null == window._applicationBasics )
			window._applicationBasics = {};
		
		const loaders = [
			this.loadAPIjs(),
			this.loadScrollCss(),
			this.loadAssortedJs(),
			this.loadManySkripts(),
		];
		await Promise.all( loaders );
	},
	getterOfText : function( path ) {
		return new Promise(( resolve, reject ) => {
			const get = new XMLHttpRequest()
			get.onload = onload
			get.open( "get", path, true )
			get.send()
			
			function onload () {
			    //console.log( 'getterOfText response', this.responseText )
			    resolve( this.responseText )
			}
		})
	},
	loadAPIjs : async function() {
		const _applicationBasics = window._applicationBasics;
		const path = '/webclient/js/apps/api.js';
		const data = await this.getterOfText( path );
		_applicationBasics.apiV1 = URL.createObjectURL( new Blob( [ data ], { type: 'text/javascript' } ));
			
			
			
			/*
			const a_ = new File( '/webclient/js/apps/api.js' );
			a_.onLoad = function( data )
			{
				_applicationBasics.apiV1 = URL.createObjectURL( new Blob( [ data ], { type: 'text/javascript' } ) );
				resolve();
			}

			a_.load()
			*/
	},
	loadScrollCss : async function() {
		const _applicationBasics = window._applicationBasics;
		const path = '/themes/friendup12/scrollbars.css';
		const css = await this.getterOfText( path );
		if( _applicationBasics.css )
			_applicationBasics.css += css;
		else 
			_applicationBasics.css = css;
			
		
		/*
		const b = new Promise(( resolve, reject ) => {
			const sb_ = new File( '/themes/friendup12/scrollbars.css' );
			sb_.onLoad = function( data )
			{
				if( _applicationBasics.css )
					_applicationBasics.css += data;
				else 
					_applicationBasics.css = data;

				resolve()
			}
			sb_.load()
		})
		*/
	},
	loadThemeCss : function() {
		addTiming( 'loadThemeCss' )
		const _applicationBasics = window._applicationBasics;
		const c = new Promise(( resolve, reject ) => {
			const cache_id = 'theme_css'
			const cache = Workspace.getFromCache( cache_id )
			if ( null != cache ) {
				setCss( cache )
			}
			else
				loadCss( cache_id )
			
			function loadCss( cache_id ) {
				let c_ = new File( '/system.library/module/?module=system&command=theme&args=%7B%22theme%22%3A%22friendup12%22%7D&sessionid=' + Workspace.sessionId );
				c_.onLoad = function( data )
				{
					Workspace.setInCache( cache_id, data )
					setCss( data )
				}
				c_.load()
			}
			
			function setCss( data ) {
				addTiming( 'setCss', data );
				if( _applicationBasics.css )
					_applicationBasics.css += data;
				else 
					_applicationBasics.css = data;
					
				resolve()
			}
		})
	},
	loadAssortedJs : async function() {
		const _applicationBasics = window._applicationBasics
		const path = '/webclient/' + [ 'js/oo.js',
				'js/api/friendappapi.js',
				'js/utils/engine.js',
				'js/utils/tool.js',
				'js/utils/json.js',
				'js/io/cajax.js',
				'js/io/appConnection.js',
				'js/io/coreSocket.js',
				'js/gui/treeview.js',
				'js/fui/fui_v1.js',
				'js/fui/classes/baseclasses.fui.js',
				'js/fui/classes/group.fui.js',
				'js/fui/classes/listview.fui.js' 
			].join( ';/webclient/' );
		const data = await this.getterOfText( path )
		window._applicationBasics.js = data
		
		
		/*
		const d = new Promise(( resolve, reject ) => {
			const js = path;
			let j_ = new File( js );
			j_.onLoad = function( data )
			{
				_applicationBasics.js = data
				resolve()
			}
			j_.load()
		});
		*/
	},
	loadManySkripts : async function() {
		const skriptsPath = '/webclient/js/gui/workspace_inside.js;' +
			'webclient/3rdparty/adapter.js;' +
			'webclient/js/utils/speech-input.js;' +
			'webclient/js/utils/events.js;' +
			'webclient/js/utils/utilities.js;' +
			'webclient/js/io/directive.js;' +
			'webclient/js/io/door.js;' +
			'webclient/js/io/dormant.js;' +
			'webclient/js/io/dormantramdisc.js;' +
			'webclient/js/io/door_system.js;' +
			'webclient/js/io/module.js;' +
			'webclient/js/io/file.js;' +
			'webclient/js/io/progress.js;' +
			'webclient/js/io/friendnetwork.js;' +
			'webclient/js/io/friendnetworkshare.js;' +
			'webclient/js/io/friendnetworkfriends.js;' +
			'webclient/js/io/friendnetworkdrive.js;' +
			'webclient/js/io/friendnetworkpower.js;' +
			'webclient/js/io/friendnetworkextension.js;' +
			'webclient/js/io/friendnetworkdoor.js;' +
			'webclient/js/io/friendnetworkapps.js;' +
			'webclient/js/io/workspace_fileoperations.js;' + 
			'webclient/js/io/DOS.js;' +
			'webclient/3rdparty/favico.js/favico-0.3.10.min.js;' +
			'webclient/js/gui/widget.js;' +
			'webclient/js/gui/listview.js;' +
			'webclient/js/gui/directoryview.js;' +
			'webclient/js/io/directoryview_fileoperations.js;' +
			'webclient/js/gui/menufactory.js;' +
			'webclient/js/gui/workspace_menu.js;' +
			'webclient/js/gui/deepestfield.js;' +
			'webclient/js/gui/filedialog.js;' +
			'webclient/js/gui/printdialog.js;' +
			'webclient/js/gui/desklet.js;' +
			'webclient/js/gui/calendar.js;' +
			'webclient/js/gui/colorpicker.js;' +
			'webclient/js/gui/workspace_calendar.js;' +
			'webclient/js/gui/workspace_tray.js;' +
			'webclient/js/gui/workspace_sharing.js;' +
			'webclient/js/gui/tutorial.js;' +
			'webclient/js/media/audio.js;' +
			'webclient/js/io/p2p.js;' +
			'webclient/js/io/request.js;' +
			'webclient/js/io/coreSocket.js;' +
			'webclient/js/io/networkSocket.js;' +
			'webclient/js/io/connection.js;' +
			'webclient/js/friendmind.js;' +
			'webclient/js/frienddos.js;' +
			'webclient/js/oo.js;' + 
			'webclient/js/api/friendAPIv1_2.js';
		
		const skriptContent = await this.getterOfText( skriptsPath );
		//const skripts = await this.loadManySkripts();
		const s = document.createElement( 'script' );
		s.innerHTML = skriptContent;
		document.body.appendChild( s );
		
		return
		/*
		return new Promise(( resolve, reject ) => {
			
			
			window.addTiming( 'skripts start load' );
			const s_ = new File( js );
			s_.onLoad = function( data )
			{
				//_applicationBasics.js = data
				console.log( 'loaded skripts in file', data );
				addTiming( 'extra skripties loaded' );
				resolve( data )
			}
			s_.load()
		});
		*/
	}
};

window.onoffline = function()
{
	Friend.User.SetUserConnectionState( 'offline' );
}
window.ononline = function()
{
	Friend.User.CheckServerConnection();
}


