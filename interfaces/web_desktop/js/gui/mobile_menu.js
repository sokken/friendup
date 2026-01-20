

(function( ns, undefined ) {
	console.log( 'ns', ns )
	ns.Mobile_menu = function( containing_element  ) {
		const self = this
		self.ws = window.Workspace
		self.container    = containing_element
		
		self.qr_butt      = null
		self.qr_opts      = {
			is_admin : false,
			workroom : false,
		}
		self.qr_available = false
		
		self.chat_butt    = null
		self.dmo_butt     = null
		self.menu_butt    = null
		self.punch_butt    = null
		self.logout_butt  = null
		
		console.log( 'Mobile_menu constructor', containing_element, self )
		self.init()
	}
	
	// Public
	
	ns.Mobile_menu.prototype.toggle_qr_available = function( opts ) {
		const self = this;
		console.log( 'toggle_qr_available', opts )
		if ( opts.is_admin != null )
			self.qr_opts.is_admin = opts.is_admin
		if ( opts.has_job != null )
			self.qr_opts.has_job = opts.has_job
		
		let is_available = ( self.qr_opts.is_admin || self.qr_opts.has_job )
		self.qr_available = is_available
		console.log( 'is_available', is_available, self.qr_opts )
		self.qr_butt.classList.toggle( 'im-disabled', !is_available )
	}
	
	// Priv
	
	ns.Mobile_menu.prototype.init = function( container ) {
		const self = this
		
		/*
		 bottom bar stuff
		*/
		
		// qr button 
		self.qr_butt = self.create_button( 'icon_butt qr_butt im-disabled', 'fa-qrcode' )
		self.qr_butt.addEventListener( 'click', on_qr_click, false )
		function on_qr_click( e ) {
			window.push_log( 'qr butt click' )
			console.log( 'qr_butt click', self.qr_available )
			if ( !self.qr_available )
				return
			
			self.ws.scanQRForDoorman()
		}
		
		/*
		// punch clock button 
		//if ( window.friendApp?.get_platform() != 'iOS' ) {
		self.punch_butt = self.create_button( 'icon_butt punch_butt', 'fa-clock-o' )
		self.punch_butt.addEventListener( 'click', on_punch_click, false )
		function on_punch_click( e ) { 
			console.log( 'punch_butt click' )
			self.ws.showPunchClockForDoorman()
		}
		*/
		
		// chat button
		self.chat_butt = self.create_button( 'switch_to_FriendChat' )
		self.chat_butt.addEventListener( 'click', on_chat_click, false )
		function on_chat_click( e ) {
			self.ws.switchToApp( 'FriendChat' )
		}
		
		// dmo button
		self.dmo_butt = self.create_button( 'switch_to_DoormanOffice' )
		self.dmo_butt.addEventListener( 'click', on_dmo_click, false )
		function on_dmo_click( e ) {
			self.ws.switchToApp( 'DoormanOffice' )
		}
		
		/*
		// logout
		self.logout_butt = self.create_button( 'icon_butt logout', 'fa-sign-out' )
		self.logout_butt.addEventListener( 'click', on_logout_click, false )
		function on_logout_click( e ) {
			self.ws.logout()
		}
		*/
		
		/*
		 menu button stuff
		*/
		
		self.menu_butt = self.create_button( 'icon_butt menu_butt', 'fa-bars' )
		self.menu_butt.addEventListener( 'click', on_menu_butt_click, false )
		self.setupMenu()
		// add menu for logout and things
		function on_menu_butt_click( e ) {
			self.toggle_menu();
		}
		
		// switch to punch clock
		self.punch_butt = self.create_in_menu_button( 'punch_clock', 'fa-clock-o', 'Stempelur' )
		self.punch_butt.addEventListener( 'click', on_punch_clock_click, false )
		async function on_punch_clock_click( e ) {
			self.toggle_menu( true );
			const res = await self.ws.showPunchClockForDoorman()
			console.log( 'punch butt res', res )
		}
		
		// logut button
		self.logout_butt = self.create_in_menu_button( 'logout', 'fa-sign-out', 'Logout' )
		self.logout_butt.addEventListener( 'click', on_logout_click, false )
		function on_logout_click( e ) {
			self.ws.logout()
		}
	}
	
	ns.Mobile_menu.prototype.create_button = function( append_class_name, append_icon_class ) {
		const self = this
		const div = document.createElement( 'div' )
		div.className = 'app_menu_item ' + append_class_name
		if ( append_icon_class ) {
			const icon = document.createElement( 'i' )
			icon.className = 'fa fa-fw ' + append_icon_class
			div.appendChild( icon )
		}
		
		self.container.appendChild( div )
		return div
	}
	
	ns.Mobile_menu.prototype.create_in_menu_button = function( class_name, icon_class, text ) {
		const self = this
		// main
		const outer = document.createElement( 'div' )
		outer.className = 'app_menu_menu_item ' + class_name
		
		// icon
		const icon_div = document.createElement( 'div' )
		icon_div.className = 'icon_butt';
		const icon = document.createElement( 'i' )
		icon.className = 'fa fa-fw ' + icon_class
		
		// text
		const text_div = document.createElement( 'div' )
		text_div.className = 'butt_text'
		text_div.innerHTML = text
		
		//
		icon_div.appendChild( icon )
		outer.appendChild( icon_div )
		outer.appendChild( text_div )
		self.menu.appendChild( outer )
		
		return outer
	}
	
	
	ns.Mobile_menu.prototype.setupMenu = function() {
		const self = this;
		self.menu = document.createElement( 'div' )
		self.menu.id = 'ws_mobile_menu'
		self.menu.className = 'hidden'
		self.menu.tabindex = -1;
		self.menu.addEventListener( 'focus', handle_focus, false )
		self.menu_hidden = true;
		self.menu.classList.toggle( 'hidden', true )
		
		self.container.appendChild( self.menu )
		
		function handle_focus( e ) {
			console.log( 'handle_focus', e );
		}
	}
	
	ns.Mobile_menu.prototype.toggle_menu = function( force ) {
		const self = this;
		if ( undefined != force  ) {
			self.menu_hidden = force;
		} else
			self.menu_hidden = !self.menu_hidden;
		
		self.menu.classList.toggle( 'hidden', self.menu_hidden )
		if ( !self.menu_hidden )
			self.menu.focus()
		
	}
	
	
})( window )
