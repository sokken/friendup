

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
		if ( opts.workroom != null )
			self.qr_opts.workroom = opts.workroom
		
		let is_available = ( self.qr_opts.is_admin || self.qr_opts.workroom )
		self.qr_available = is_available
		console.log( 'is_available', is_available, self.qr_opts )
		self.qr_butt.classList.toggle( 'im-disabled', !is_available )
	}
	
	// Priv
	
	ns.Mobile_menu.prototype.init = function( container ) {
		const self = this
		// qr button 
		self.qr_butt = self.create_button( 'icon_butt qr_butt im-disabled', 'fa-qrcode' )
		self.qr_butt.addEventListener( 'click', on_qr_click, false )
		function on_qr_click( e ) { 
			console.log( 'qr_butt click', self.qr_available )
			if ( !self.qr_available )
				return
			
			self.ws.scanQRForDoorman()
		}
		
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
		
		// logut button
		self.logout_butt = self.create_button( 'icon_butt logout', 'fa-sign-out' )
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
	
	
})( window )
