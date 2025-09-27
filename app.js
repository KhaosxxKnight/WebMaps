const loadingElement = document.getElementById('loading');
const infoElement = document.getElementById('info');

// Проверка наличия OpenLayers
if (!ol || !ol.source?.GeoTIFF) {
  console.error("Ошибка: OpenLayers или GeoTIFF источник не загружен!");
  loadingElement.innerHTML = "Ошибка: Не удалось загрузить OpenLayers или GeoTIFF источник";
  throw new Error("OpenLayers или GeoTIFF источник не загружен");
}

console.log("OpenLayers загружен, GeoTIFF источник доступен");

// Базовая карта (OSM)
const map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM(),
    }),
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([56.0, 54.74]),
    zoom: 7,
  }),
});

// Переменные для хранения слоев
let currentLayer = null;
let geoTiffLayer1 = null;
let geojsonLayer = null;
let geoTiffLayer2 = null;
let geoTiffLayer4 = null;
let geoTiffLayer5 = null;

// Новые переменные для векторных слоев
let pointsLayer = null;
let linesLayer = null;
let polygonsLayer = null;

// Информационная панель
function updateInfo(text) {
  infoElement.innerHTML = '<h4>GeoTIFF Viewer</h4>' + (text || '...');
}

// Функция для активации кнопки
function setActiveButton(buttonId) {
  document.querySelectorAll('.layer-controls button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.getElementById(buttonId);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
}

// Функция для переключения состояния векторных кнопок
function toggleVectorButton(buttonId, isActive) {
  const button = document.getElementById(buttonId);
  if (button) {
    if (isActive) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  }
}

// Функция удаления текущего слоя
function removeCurrentLayer() {
  if (currentLayer) {
    map.removeLayer(currentLayer);
    currentLayer = null;
  }
}

// Функция удаления всех векторных слоев
function removeAllVectorLayers() {
  if (pointsLayer) {
    map.removeLayer(pointsLayer);
    pointsLayer = null;
    toggleVectorButton('togglePoints', false);
  }
  
  if (linesLayer) {
    map.removeLayer(linesLayer);
    linesLayer = null;
    toggleVectorButton('toggleLines', false);
  }
  
  if (polygonsLayer) {
    map.removeLayer(polygonsLayer);
    polygonsLayer = null;
    toggleVectorButton('togglePolygons', false);
  }
  
  console.log("Все векторные слои удалены");
  updateInfo("Векторные слои очищены");
}

// Улучшенная функция подгонки карты под границы источника
function fitToGeoTIFF(geoTiffSource, layerName = '') {
  return new Promise((resolve) => {
    const tryFit = () => {
      if (geoTiffSource.getState() === 'ready') {
        const viewConfig = geoTiffSource.getView();
        let extent = null;

        // Пробуем разные способы получить extent
        if (viewConfig?.extent) {
          extent = viewConfig.extent;
          console.log(`[${layerName}] extent из getView():`, extent);
        } else if (geoTiffSource.getTileGrid) {
          extent = geoTiffSource.getTileGrid().getExtent();
          console.log(`[${layerName}] extent из getTileGrid():`, extent);
        }

        if (extent && !extent.some(coord => !isFinite(coord))) {
          map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 18, // Увеличим максимальный zoom для лучшего приближения
            duration: 1500,
          });
          console.log(`[${layerName}] Карта подогнана под GeoTIFF:`, extent);
          resolve(true);
        } else {
          console.warn(`[${layerName}] Границы не найдены или невалидны, пробуем снова...`);
          setTimeout(tryFit, 500);
        }
      } else if (geoTiffSource.getState() === 'error') {
        console.error(`[${layerName}] Ошибка загрузки источника`);
        resolve(false);
      } else {
        // Если источник еще не готов, ждем и пробуем снова
        setTimeout(tryFit, 500);
      }
    };

    // Запускаем первую попытку
    tryFit();
  });
}

// Загрузка первого GeoTIFF (my1_rgb_fixed.tif)
async function loadLayer1() {
  try {
    removeCurrentLayer();
    
    if (!geoTiffLayer1) {
      const tiffUrl = "my1_rgb_fixed.tif";
      console.log("Загружаю GeoTIFF:", tiffUrl);
      updateInfo("Загрузка GeoTIFF...");
      loadingElement.textContent = "Загрузка GeoTIFF...";

      const response = await fetch(tiffUrl);
      if (!response.ok) throw new Error(`Файл не найден: ${response.status} ${response.statusText}`);

      const geoTiffSource = new ol.source.GeoTIFF({
        sources: [{ url: tiffUrl, bands: [1, 2, 3] }],
        normalize: true,
      });

      geoTiffLayer1 = new ol.layer.WebGLTile({
        source: geoTiffSource,
        opacity: 0.9,
      });

      // Немедленно пытаемся приблизиться при первой загрузке
      await fitToGeoTIFF(geoTiffSource, 'my1_rgb_fixed');
    }

    map.addLayer(geoTiffLayer1);
    currentLayer = geoTiffLayer1;
    console.log("GeoTIFF слой добавлен!");

    // Всегда подгоняем карту при переключении на слой
    if (geoTiffLayer1.getSource().getState() === 'ready') {
      fitToGeoTIFF(geoTiffLayer1.getSource(), 'my1_rgb_fixed');
    }

    setActiveButton('layer1');
    updateInfo("Файл: my1_rgb_fixed.tif");
    loadingElement.style.display = "none";
    
  } catch (err) {
    console.error("Ошибка загрузки слоя 1:", err);
    updateInfo("Ошибка загрузки my1_rgb_fixed.tif!");
    loadingElement.innerHTML = "Ошибка: " + err.message;
  }
}

// Загрузка GeoJSON (3.geojson)
async function loadLayer2() {
  try {
    removeCurrentLayer();
    
    if (!geojsonLayer) {
      const geojsonUrl = "3.geojson";
      console.log("Загружаю GeoJSON:", geojsonUrl);
      updateInfo("Загрузка GeoJSON...");

      const response = await fetch(geojsonUrl);
      if (!response.ok) {
        throw new Error(`Файл не найден: ${response.status} ${response.statusText}`);
      }

      const geojsonSource = new ol.source.Vector({
        url: geojsonUrl,
        format: new ol.format.GeoJSON()
      });

      geojsonLayer = new ol.layer.Vector({
        source: geojsonSource,
        style: new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: 'blue',
            width: 2
          }),
          fill: new ol.style.Fill({
            color: 'rgba(0, 0, 255, 0.1)'
          })
        })
      });

      geojsonSource.on('change', function() {
        if (geojsonSource.getState() === 'ready') {
          const extent = geojsonSource.getExtent();
          if (extent && extent[0] !== Infinity) {
            map.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              maxZoom: 15,
              duration: 1000,
            });
          }
        }
      });
    }

    map.addLayer(geojsonLayer);
    currentLayer = geojsonLayer;

    // Всегда подгоняем карту при переключении на GeoJSON слой
    if (geojsonLayer.getSource().getState() === 'ready') {
      const extent = geojsonLayer.getSource().getExtent();
      if (extent && extent[0] !== Infinity) {
        map.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          maxZoom: 15,
          duration: 1000,
        });
      }
    }

    setActiveButton('layer2');
    updateInfo("Активный слой: 3.geojson");
    
  } catch (err) {
    console.error("Ошибка загрузки слоя 2:", err);
    updateInfo("Ошибка загрузки 3.geojson: " + err.message);
  }
}

// Загрузка второго GeoTIFF (Landsat.tif)
async function loadLayer3() {
  try {
    removeCurrentLayer();
    
    if (!geoTiffLayer2) {
      const tiffUrl = "Landsat.tif";
      console.log("Загружаю GeoTIFF:", tiffUrl);
      updateInfo("Загрузка Landsat.tif...");

      const response = await fetch(tiffUrl);
      if (!response.ok) {
        throw new Error(`Файл не найден: ${response.status} ${response.statusText}`);
      }

      const geoTiffSource = new ol.source.GeoTIFF({
        sources: [
          {
            url: tiffUrl,
            bands: [1, 2, 3],
          },
        ],
        normalize: true,
      });

      geoTiffLayer2 = new ol.layer.WebGLTile({
        source: geoTiffSource,
        opacity: 0.9,
      });

      // Подгоняем при первой загрузке
      await fitToGeoTIFF(geoTiffSource, 'Landsat');
    }

    map.addLayer(geoTiffLayer2);
    currentLayer = geoTiffLayer2;
    console.log("Landsat GeoTIFF слой добавлен!");

    // Всегда подгоняем карту при переключении на слой
    if (geoTiffLayer2.getSource().getState() === 'ready') {
      fitToGeoTIFF(geoTiffLayer2.getSource(), 'Landsat');
    }

    setActiveButton('layer3');
    updateInfo("Активный слой: Landsat.tif");
    
  } catch (err) {
    console.error("Ошибка загрузки слоя 3:", err);
    updateInfo("Ошибка загрузки Landsat.tif: " + err.message);
    
    if (err.message.includes('404')) {
      console.log("Файл Landsat.tif не найден. Используйте только кнопки 1 и 2.");
    }
  }
}

// Загрузка третьего GeoTIFF (Sentinal.tif)
async function loadLayer4() {
  try {
    removeCurrentLayer();
    
    if (!geoTiffLayer4) {
      const tiffUrl = "Sentinal.tif";
      console.log("Загружаю GeoTIFF:", tiffUrl);
      updateInfo("Загрузка Sentinal.tif...");

      const response = await fetch(tiffUrl);
      if (!response.ok) {
        throw new Error(`Файл не найден: ${response.status} ${response.statusText}`);
      }

      const geoTiffSource = new ol.source.GeoTIFF({
        sources: [
          {
            url: tiffUrl,
            bands: [1, 2, 3],
          },
        ],
        normalize: true,
      });

      geoTiffLayer4 = new ol.layer.WebGLTile({
        source: geoTiffSource,
        opacity: 0.9,
      });

      // Подгоняем при первой загрузке
      await fitToGeoTIFF(geoTiffSource, 'Sentinal');
    }

    map.addLayer(geoTiffLayer4);
    currentLayer = geoTiffLayer4;
    console.log("Sentinal.tif GeoTIFF слой добавлен!");

    // Всегда подгоняем карту при переключении на слой
    if (geoTiffLayer4.getSource().getState() === 'ready') {
      fitToGeoTIFF(geoTiffLayer4.getSource(), 'Sentinal');
    }

    setActiveButton('layer4');
    updateInfo("Активный слой: Sentinal.tif");
    
  } catch (err) {
    console.error("Ошибка загрузки слоя 4:", err);
    updateInfo("Ошибка загрузки Sentinal.tif: " + err.message);
    
    if (err.message.includes('404')) {
      console.log("Файл Sentinal.tif не найден. Используйте только кнопки 1 и 2.");
    }
  }
}

// Загрузка пятого GeoTIFF (Umbra3.tif)
async function loadLayer5() {
  try {
    removeCurrentLayer();
    
    if (!geoTiffLayer5) {
      const tiffUrl = "Umbra3.tif";
      console.log("Загружаю GeoTIFF:", tiffUrl);
      updateInfo("Загрузка Umbra3.tif...");

      const response = await fetch(tiffUrl);
      if (!response.ok) {
        throw new Error(`Файл не найден: ${response.status} ${response.statusText}`);
      }

      const geoTiffSource = new ol.source.GeoTIFF({
        sources: [
          {
            url: tiffUrl,
            bands: [1, 2, 3],
            min: 0,
            max: 255
          },
        ],
        normalize: true,
        wrapX: false,
      });

      geoTiffLayer5 = new ol.layer.WebGLTile({
        source: geoTiffSource,
        opacity: 1.0,
      });

      // Подгоняем при первой загрузке
      await fitToGeoTIFF(geoTiffSource, 'Umbra3');
    }

    map.addLayer(geoTiffLayer5);
    currentLayer = geoTiffLayer5;
    console.log("Umbra3.tif GeoTIFF слой добавлен!");

    // Всегда подгоняем карту при переключении на слой
    if (geoTiffLayer5.getSource().getState() === 'ready') {
      fitToGeoTIFF(geoTiffLayer5.getSource(), 'Umbra3');
    }

    setActiveButton('layer5');
    updateInfo("Активный слой: Umbra3.tif");
    
  } catch (err) {
    console.error("Ошибка загрузки слоя 5:", err);
    updateInfo("Ошибка загрузки Umbra3.tif: " + err.message);
  }
}
// Функции для векторных слоев
async function togglePoints() {
  try {
    if (pointsLayer) {
      map.removeLayer(pointsLayer);
      pointsLayer = null;
      toggleVectorButton('togglePoints', false);
      console.log("Слой точек удален");
      return;
    }

    const geojsonUrl = "points.geojson";
    console.log("Загружаю точки:", geojsonUrl);

    const response = await fetch(geojsonUrl);
    if (!response.ok) throw new Error(`Файл не найден: ${response.status}`);

    const vectorSource = new ol.source.Vector({
      url: geojsonUrl,
      format: new ol.format.GeoJSON()
    });

    pointsLayer = new ol.layer.Vector({
      source: vectorSource,
      style: new ol.style.Style({
        image: new ol.style.Circle({
          radius: 6,
          fill: new ol.style.Fill({ color: 'red' }),
          stroke: new ol.style.Stroke({ color: 'white', width: 2 })
        })
      })
    });

    map.addLayer(pointsLayer);
    toggleVectorButton('togglePoints', true);
    console.log("Слой точек добавлен");

  } catch (err) {
    console.error("Ошибка загрузки точек:", err);
    updateInfo("Ошибка загрузки точек: " + err.message);
  }
}

async function toggleLines() {
  try {
    if (linesLayer) {
      map.removeLayer(linesLayer);
      linesLayer = null;
      toggleVectorButton('toggleLines', false);
      console.log("Слой линий удален");
      return;
    }

    const geojsonUrl = "lines.geojson";
    console.log("Загружаю линии:", geojsonUrl);

    const response = await fetch(geojsonUrl);
    if (!response.ok) throw new Error(`Файл не найден: ${response.status}`);

    const vectorSource = new ol.source.Vector({
      url: geojsonUrl,
      format: new ol.format.GeoJSON()
    });

    linesLayer = new ol.layer.Vector({
      source: vectorSource,
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'blue',
          width: 3
        })
      })
    });

    map.addLayer(linesLayer);
    toggleVectorButton('toggleLines', true);
    console.log("Слой линий добавлен");

  } catch (err) {
    console.error("Ошибка загрузки линий:", err);
    updateInfo("Ошибка загрузки линий: " + err.message);
  }
}

async function togglePolygons() {
  try {
    if (polygonsLayer) {
      map.removeLayer(polygonsLayer);
      polygonsLayer = null;
      toggleVectorButton('togglePolygons', false);
      console.log("Слой полигонов удален");
      return;
    }

    const geojsonUrl = "polygons.geojson";
    console.log("Загружаю полигоны:", geojsonUrl);

    const response = await fetch(geojsonUrl);
    if (!response.ok) throw new Error(`Файл не найден: ${response.status}`);

    const vectorSource = new ol.source.Vector({
      url: geojsonUrl,
      format: new ol.format.GeoJSON()
    });

    polygonsLayer = new ol.layer.Vector({
      source: vectorSource,
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'green',
          width: 2
        }),
        fill: new ol.style.Fill({
          color: 'rgba(0, 255, 0, 0.2)'
        })
      })
    });

    map.addLayer(polygonsLayer);
    toggleVectorButton('togglePolygons', true);
    console.log("Слой полигонов добавлен");

  } catch (err) {
    console.error("Ошибка загрузки полигонов:", err);
    updateInfo("Ошибка загрузки полигонов: " + err.message);
  }
}

// Инициализация карты
(async function () {
  try {
    console.log("Инициализация карты...");
    
    // Загружаем первый слой по умолчанию
    await loadLayer1();
    
    // Добавляем обработчики для кнопок
    document.getElementById('layer1').addEventListener('click', loadLayer1);
    document.getElementById('layer2').addEventListener('click', loadLayer2);
    document.getElementById('layer3').addEventListener('click', loadLayer3);
    document.getElementById('layer4').addEventListener('click', loadLayer4);
    document.getElementById('layer5').addEventListener('click', loadLayer5);
    
    // Добавляем обработчики для векторных кнопок
    document.getElementById('togglePoints').addEventListener('click', togglePoints);
    document.getElementById('toggleLines').addEventListener('click', toggleLines);
    document.getElementById('togglePolygons').addEventListener('click', togglePolygons);
    document.getElementById('clearVectors').addEventListener('click', removeAllVectorLayers);

    console.log("Карта инициализирована успешно");
    
  } catch (err) {
    console.error("Ошибка инициализации:", err);
    updateInfo("Ошибка инициализации!");
    loadingElement.innerHTML = "Ошибка: " + err.message;
  }
})();
