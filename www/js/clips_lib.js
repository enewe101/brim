function _check_key(e) {
	var evtobj=window.event? event : e;
	var unicode=evtobj.charCode? evtobj.charCode : evtobj.keyCode;
	if (unicode==13) {
		emit(this.value);
		this.value = '';
	}
}	

