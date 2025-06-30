console.log("Mapa cargado");

var map = L.map('map').fitBounds([[-60, -130], [70, 40]]);

L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
    maxZoom: 18
}).addTo(map);

var clusterGlobal = L.markerClusterGroup({ disableClusteringAtZoom: 2 });
var todosLosPuntos = [];
var estadoSeleccionado = "";
var especialidadActiva = false;
var poligonoLayers = {};
var poligonoSeleccionadoID = null;  
var zoomGeneral = [[-60, -130], [70, 40]];

const coloresEspecialidad = {
    "Antropología":"#ffff99",
    "Arqueología": "#a6cee3",
    "Comunicación": "#1f78b4",
    "Educación": "#b2df8a",
    "Filosofía": "#33a02c",
    "Género": "#fb9a99",
    "Historia": "#e31a1c",
    "Humanidades Digitales": "#fdbf6f",
    "Literatura": "#ff7f00",
    "Sociología": "#cab2d6",
    "Teatro": "#6a3d9a"
};

function getColorEspecialidad(espec) {
    return coloresEspecialidad[espec] || "#999999";
}

function cargarPoligono(id) {
    return fetch(id + '.geojson')
        .then(res => res.json())
        .then(data => {
            var layer = L.geoJSON(data, { style: {color:'#5b758b', weight:2} });
            poligonoLayers[id] = layer;
        });
}

var polIDs = ["REGION_02","REGION_01","PAIS_01","PROVINCIA_02","REGION_03",
              "REGION_05","REGION_06", "REGION_07","REGION_08"];

var nombresPoligonos = {
    "REGION_02": "Europa",
    "REGION_01": "Latinoamérica",
    "PAIS_01": "Argentina",
    "PROVINCIA_02": "Provincia de Salta",
    "REGION_03": "Norte de Argentina",
    "REGION_05": "Valle de Lerma",
    "REGION_06": "Valle Calchaquí",
    "REGION_07": "Puna",
    "REGION_08": "Chaco salteño"
};

var promesasPoligonos = polIDs.map(id => cargarPoligono(id));

var promesaPuntos = fetch('puntos.geojson')
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            pointToLayer: function(feature, latlng) {
                return L.marker(latlng, {
                    icon: L.divIcon({
                        html: '<ion-icon name="location" style="font-size:24px;color:#474c52;"></ion-icon>',
                        className: '',
                        iconSize: [30, 30]
                    })
                });
            },
            onEachFeature: function(feature, layer) {
                var props = feature.properties;
                layer.bindPopup(`
                    <b>Proyecto:</b> ${props.NOMBRE}<br><br>
                    <b>Director/a:</b> ${props.DIRECTOR}<br><br>
                    <b>Institución financiadora:</b> ${props.Inst_cod}<br><br>
                    <b>Especialidad:</b> ${props.ESPECIALID}<br><br>
                    <b>Palabras clave:</b> ${props.PALABRAS_c}<br><br>
                    <b>Estado:</b> ${props.ESTADO}<br><br>
                    <b>Año de inicio:</b> ${props.AÑO_INICIO}<br><br>
                    <b>Año de finalización:</b> ${props.AÑO_FINAL}
                `);
                todosLosPuntos.push({ feature, layer });
            }
        });
        actualizarPuntos();
        clusterGlobal.addTo(map);
    });

Promise.all([...promesasPoligonos, promesaPuntos]).then(() => {
    var overlays = {};
    polIDs.forEach(id => {
        overlays[nombresPoligonos[id]] = poligonoLayers[id];
    });

    L.control.layers(null, overlays, {collapsed:false}).addTo(map);

    map.on('overlayadd', function(e) {
        var polID = Object.keys(nombresPoligonos).find(key => nombresPoligonos[key] === e.name);
        if(polID){
            poligonoSeleccionadoID = polID;  // 🔍 Marcar polígono activo
            map.flyToBounds(poligonoLayers[polID].getBounds());
            actualizarPuntos();
        }
    });

    map.on('overlayremove', function(e) {
        var polID = Object.keys(nombresPoligonos).find(key => nombresPoligonos[key] === e.name);
        if (polID && polID === poligonoSeleccionadoID) {
            poligonoSeleccionadoID = null; // ❌ Sin polígono activo
            map.flyToBounds(zoomGeneral);
            actualizarPuntos();
        }
    });
});

function actualizarPuntos() {
    clusterGlobal.clearLayers();

    todosLosPuntos.forEach(obj => {
        var p = obj.feature.properties;
        var mostrar = true;

        // 🔍 Si hay polígono activo, filtrar solo puntos de ese polígono
        if (poligonoSeleccionadoID && p.ID_POLIG !== poligonoSeleccionadoID) {
            mostrar = false;
        }

        // 🔍 Filtro por Estado
        if (estadoSeleccionado && p.ESTADO !== estadoSeleccionado) {
            mostrar = false;
        }

        if (mostrar) {
            var color = especialidadActiva ? getColorEspecialidad(p.Espec_cod) : "#474c52";
            obj.layer.setIcon(L.divIcon({
                html: `<ion-icon name="location" style="font-size:24px;color:${color};"></ion-icon>`,
                className: '',
                iconSize: [30, 30]
            }));
            clusterGlobal.addLayer(obj.layer);
        }
    });
}

document.getElementById('filtroEstado').addEventListener('change', function(){
    estadoSeleccionado = this.value;
    actualizarPuntos();
});

document.getElementById('toggleEspecialidad').addEventListener('click', function(){
    especialidadActiva = !especialidadActiva;
    this.classList.toggle('active', especialidadActiva);
    document.getElementById('leyendaEspecialidad').style.display = especialidadActiva ? 'block' : 'none';
    actualizarPuntos();
});

document.getElementById('limpiarFiltros').addEventListener('click', function(){
    estadoSeleccionado = "";
    especialidadActiva = false;
    poligonoSeleccionadoID = null; // ❌ Desactivar polígono activo
    document.getElementById('filtroEstado').value = "";
    document.getElementById('leyendaEspecialidad').style.display = 'none';
    document.getElementById('toggleEspecialidad').classList.remove('active');
    map.flyToBounds(zoomGeneral);
    actualizarPuntos();

    const btn = this;
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 500);
});
