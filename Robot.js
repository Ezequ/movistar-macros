function runRobot(needLogin) {
	var loginTry = 0;
	if (checkIfUserIsLogOut(loginTry)){
		iimDisplay('Deslogueado, intentando loguear.');
		var credentials = getCredentials();
		if (!credentials|| !credentials.user || !credentials.password){
			window.alert('No hay credenciales, no se puede continuar');
			return 
		}
		iimDisplay('USUARO:'+credentials.user+' CONTRASENA:'+credentials.password);
		iimSet("USER", credentials.user);
		iimSet("PASSWORD",credentials.password);
		iimPlay("Movistar\\1_Login");
	}
	//iimPlay("Claro\\1.5_Sisact-Aplicaciones");
	
	var retry2 = 30;
	var processed = 0;
	var needNextRuc = true;
	var taskInformation = '';
	var ruc = '';
	var taskId = '';
	for (ret2 = 0; ret2 < retry2 ; ret2++) {
		// Login en SISACT
		if (checkIfUserIsLogOut(loginTry)){
			return processed;
		}
		//var result = iimPlay("Claro\\2_Sisact-Login");	
		// chequeo si existe reportes
		var reportsExists = searchMenuExists();
		if (reportsExists ) {
			var retry3 = 10;
			var errorServerRetry = 3;
			for (i = 0; i < retry3 ; i++) {
			// Busqueda de RUCS
				if (needNextRuc){
					taskInformation = getNextRuc(true);
					if (!taskInformation || !taskInformation.ruc || !taskInformation.id){
						window.alert('No pending tasks');
						
					} else {
						window.alert("RUC: "+taskInformation.ruc);
					}
					errorServerRetry = 3;
					ruc = taskInformation.ruc;
					taskId = taskInformation.id;
				}
				iimSet("RUC", ruc)
			  	var screenIsLoaded = iimPlay("Movistar\\2_Busqueda");
			  	window.alert(screenIsLoaded);
				// Validacion de datos necesarios para buscar lineas activas
				if (screenIsLoaded !=  '-802' && screenIsLoaded !=  '-1450' && screenIsLoaded !=  '-971'){
					var error = checkIfLinesExists();
					//window.alert('cargo bien');	
				} else if (screenIsLoaded ==  '-802') {
					var error = 2;
					needNextRuc = sendInformation(taskId, 'CLIENTE-NO-ENCONTRADO', ruc);
					return processed;
					window.alert('cargo mal');	
				} else if (screenIsLoaded == '-971') {
					var error = 2;
					needNextRuc = sendInformation(taskId, 'RUC-INVALIDO', ruc);
					return processed;
				}
				//window.alert(error);
				if (error) {
					if (error == 2) {
						// El RUC no tiene la info asique aviso al sistema
						needNextRuc = sendInformation(taskId, 'NO-INFO', ruc);
						//goBackToSisacLogin()
						cancelButtonOfLines();
						continue;
					} else {
						//iimDisplay('404, volvemos a loguear en sisact');
						needNextRuc = true;
						goBackToSisacLogin()
						break;
					}
					window.alert('asd');
				} else {
					var checked = selectClientsCheckboxes();
					if (checked == -1) {
						needNextRuc = false;
						break;
					} else if (checked == 0) {
						sendInformation(taskId, 'NO-INFO', ruc);
						needNextRuc = true;
						//goBackToSisacLogin();
						cancelButtonOfLines();
						continue;
					}
					// iimPlay("Claro\\4_Busqueda-Lineas-Activas");					
					var table = getTableToSend();
					if (table == false) {
						needNextRuc = false;
						goBackToSisacLogin();
						break;
					}
					if (table === "ERROR-SERVIDOR") {
						errorServerRetry--;
						if (errorServerRetry <= 0) {
							// Fallo muchas veces, mando mail avisando y se guarda como error
							requestApi('POST',false,{'msg':'El servidor de claro esta funcionando mal ruc:'+ruc, 'robot':'claro'},'pending_task/send_email');
							errorServerRetry = 3;
						} else {
							// Falla servidor entonces reintento
							needNextRuc = false;
							goBackToSisacLogin();
							continue;
						}
					}
					// Si funciono correctamente , leo el proximo
					needNextRuc = sendInformation(taskId, table, ruc);
					processed++;
				}
			} 
			//window.alert(i);
		} else {
			continue;
		}
	}
	return processed;
}

function cancelButtonOfLines(){
	iimPlayCode('TAG POS=1 TYPE=INPUT:BUTTON FORM=ID:frmPrincipal ATTR=ID:cmdCancelar');
}

function getCredentials(){
	//var credentials = {'user':'D99937381','password':'Febrero2020+*'};
	var credentials = requestApi('GET', false, {}, 'pending_task/credentials/movistar');
	return JSON.parse(credentials.response);
}

function checkIfUserIsLogOut(loginTry)
{
	loginTry++;
	// Chequeo primero si se colgo la app y hay que reiniciar la maquina
	if (window.content.document.body == null){
		return true;
	}
	if (window.content.document.body.innerHTML.includes('Acepto los terminos y condiciones.')){
		//requestApi('POST',false,{'msg':'Fallo el login a Claro', 'subject':'Revisar el usuario y contrasena', 'robot':'claro'},'pending_task/send_email');
		window.alert('Deslogueado');
		return true;
	} else if (window.content.document.body.innerHTML.includes('La evaluación de la política')) {
		//window.alert('ERROR:Evaluacion politica de usuario intentos:'+loginTry);
	} else if (window.content.document.body.innerHTML.includes('ACTUALIZACIÓN DEL PORTAL VPNSSL CLARO')){
		return true;
	}
	var href = window.location.href;
	iimDisplay('HREF:'+href );
	return href == "https://portalvpnssl.claro.com.pe/vdesk/hangup.php3" || href == "https://portalvpnssl.claro.com.pe/my.logout.php3?errorcode=20" || href== "about:blank";
}

function goBackToSisacLogin() {
	//var found = iimPlayCode('TAG POS=1 TYPE=INPUT:BUTTON FORM=ID:frmPrincipal ATTR=ID:cmdCancelar');	
	iimPlay("Claro\\2_Sisact-Login");
	return ;
}

function sendInformation(id, lines, ruc)
{
	var result = requestApi('POST',false,{'id':id, 'claro_lines_information_html':window.btoa(lines)},'pending_task/resolve');
	if (result) {
		iimDisplay('ENVIADA INFO DE:'+ruc);
	}
	return result;
}

function requestApi(method, async, data, uri) {
	var url = 'http://ec2-18-224-29-192.us-east-2.compute.amazonaws.com/api/'+uri;
	//window.alert(url);
	var request = Components.classes['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Components.interfaces.nsIXMLHttpRequest);  	
    	request.open(method, url, async);    	
    	request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    	request.send(JSON.stringify(data));
    	//window.alert();
    	if (request.status !== 200) {
        	var message = 'an error occurred while loading script at url: ' + url + ', status: ' + request.status;
        	iimDisplay(request.status);
        	return false;
    	}
    	return request;
}


function prueba() {
	var table = window.content.document.getElementsByName('main')[0].contentDocument.getElementsByName('iframeBody')[0].contentDocument.body.innerHTML;
	//requestApi('20101014097',table);
}

function getNextRuc(onlyCheck) {
	if (onlyCheck) {
		var onlyCheck = '?only_check='+onlyCheck;
	} else {
		var onlyCheck = '';
	}

	var information = requestApi('GET', false, {'only_check':true}, 'pending_task/next/movistar'+onlyCheck );
	if (information) {
		var taskInformation = JSON.parse(information.response);
		iimDisplay('RUC procesandose:'+taskInformation.ruc);
		return taskInformation ;
	} else {
		return false;
	}
}

function checkIfCanInit() {
	return true;
	var information = requestApi('GET', false, {}, 'pending_task/init/claro');
	if (information) {
		var taskInformation = JSON.parse(information.response);
		iimDisplay('RUC procesandose:'+taskInformation.ruc);
		return taskInformation ;
	} else {
		return false;
	}
}

function searchMenuExists() {
	var exists = false;
	try {
		var exists = window.content.document.body.innerHTML.includes('RUC/DNI/CEX');
	} catch(error) {
		iimDisplay('No encontrado menu para buscar rucs');
	}
	return exists;
}


function checkIfLinesExists() {
	// Verificacion de resultado de busqueda
	if (window.content.document.body.innerHTML.includes('(403) Forbidden.')) {
		return 1;
	}
	if (window.content.document.body.innerHTML.includes('Length cannot be less than zero')){
		return 2;
	}
	return 0;
}

function getTableToSend() {
	var table = "";
	try {
		table = window.content.document.getElementsByName('main')[0].contentDocument.getElementsByName('iframeBody')[0].contentDocument.body.innerHTML;
		if (table.includes('The remote server returned an error')) {

			return "ERROR-SERVIDOR";
			window.alert('El servidor de claro esta funcionando mal.');
		}
	} catch (error) {
		iimDisplay("Error obteniendo la table:"+error);
		table = false;
	}
	return table;
}

function selectClientsCheckboxes() {
	try {
		var rows = window.content.document.getElementById("DataGrid1").rows;
		var checked = 0;
		for (var i = 1; i < rows.length; i++) {
			var currentRow = rows[i];
			var currentTds = currentRow .childNodes;
			var activeLines = parseInt(currentTds[11].textContent);
			var inActiveLines = parseInt(currentTds[12].textContent);
			if (activeLines + inActiveLines > 0) {
				checked++;
				iimPlayCode("TAG POS="+i+" TYPE=INPUT:CHECKBOX FORM=ID:frmPrincipal ATTR=ID:optSel CONTENT=YES");
				if (checked > 3){
					break;
				}
			}
		}
		iimPlayCode("TAG POS=1 TYPE=INPUT:BUTTON FORM=ID:frmPrincipal ATTR=ID:cmdSeleccionar");
		iimPlayCode("WAIT SECONDS=5");
	} catch (error) {
		iimDisplay("Error chequeando los clientes:"+error);
		checked = -1;
	}	
	return checked;
}

var processed = 0;
/*for (var i = 1; i < 30; i++) {
	var taskInformation = checkIfCanInit();
	if (!taskInformation || !taskInformation.ruc || !taskInformation.id){
		iimDisplay("No hay mas pendientes o robot desactivado:");
		break;		
	}
	iimDisplay("Corriendo el robot, intento numero "+i);
	processed = processed  + runRobot(true);
}*/
runRobot(true);
iimDisplay("Llego a su fin, procesados:"+processed);
// The remote server returned an error
