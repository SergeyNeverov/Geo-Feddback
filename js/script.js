// попап с формой отзыва почему то открывается только по двойному клику по карте и по метки с одним отзывом, пока не могу понять, почему
new Promise( resolve => {
    window.onload = resolve;
    // ждем полную загрузку страницы
}).then( () => {
    return new Promise( resolve => {
        ymaps.ready(resolve);
    });
    // создаем карты если promise переходит в fulfilled
}).then( () => {
    Model.map = Model.createMap('myMap', [55.75399400, 37.62209300], 13);
    Model.clusterer = Model.addCluster();
    Model.map.geoObjects.add(Model.clusterer);

    Model.map.events.add('click', e => {
        Model.clusterer.balloon.close();
        let clickCoords = e.get('pagePixels'),
            geoCoords = e.get('coords');

        Model.getAdressFromCoords(geoCoords).then( address => {
            Router.handle('openPopup', {
                clickCoords: clickCoords,
                address: address,
                emptyFeedbackList: 'Отзывов пока нет'
            });
        });

    });
    Model.clusterer.events.add('balloonopen', () => {
        View.close('popup');
    });
});

let Model = {
    actualCoords: [],
    actualAddress: '',
    feedbackData: [],

    createMap(container, centerCoords, zoomRate) {
        return new ymaps.Map(container, {
            center: centerCoords,
            zoom: zoomRate,
        });
    },
    // кластеризация якарт
    addCluster() {
        return new ymaps.Clusterer({
            groupByCoordinates: false,
            clusterOpenBalloonOnClick: true,
            clusterDisableClickZoom: true,
            clusterBalloonContentLayout: 'cluster#balloonCarousel',
            clusterBalloonItemContentLayout: View.customBallonLayout(),
            clusterBalloonPanelMaxMapArea: 0,
            clusterBalloonContentLayoutWidth: 300,
            clusterBalloonContentLayoutHeight: 200,
            hideIconOnBalloonOpen: false,
            preset: 'islands#invertedDarkOrangeClusterIcons'
        });
    },
    // получаем адрес с координат
    getAdressFromCoords(coords) {
        Model.actualCoords = coords;

        return new Promise( resolve => {
            let result = ymaps.geocode(coords);
            resolve(result);
        }).then( result => {
            Model.actualAddress = result.geoObjects.get(0).properties.get('text');
            return Model.actualAddress;
        });
    },
    // добавление отзыва
    addFeedback() {
        let fieldsList = document.querySelector('#feedbackForm').elements,
            emptyFieldList = Array.prototype.filter.call(fieldsList, item => {
                return !item.value.trim().length;
            });
        // получить пустой массив значений с формы, без пробелов []
        return new Promise( (resolve, reject) => {
            if(!emptyFieldList.length) {
                let presentTime = new Date().toLocaleDateString("ru", {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric'
                });
                let feedbackData = {
                    geoObjectCoords: Model.actualCoords,
                    geoObjectAddress: Model.actualAddress,
                    feedbackDetails: {
                        timeOfFeedback: presentTime,
                        name: fieldsList[0].value,
                        place: fieldsList[1].value,
                        feedbackText: fieldsList[2].value
                    }
                };

                Model.feedbackData.push(feedbackData);

                let geoObject = new ymaps.Placemark(Model.actualCoords, {
                    place: feedbackData.feedbackDetails.place,
                    coords: feedbackData.geoObjectCoords,
                    address: feedbackData.geoObjectAddress,
                    feedbackText: feedbackData.feedbackDetails.feedbackText,
                    timeOfFeedback: feedbackData.feedbackDetails.timeOfFeedback
                }, {
                    preset: 'islands#darkOrangeDotIcon'
                });

                geoObject.events.add('click', e => {
                    Model.clusterer.balloon.close();
                    let clickCoords = e.get('pagePixels');
                    Model.actualCoords = e.get('target').properties.get('coords');
                    Model.actualAddress = e.get('target').properties.get('address');

                    Router.handle('openPopup', {
                        clickCoords: clickCoords,
                        address: Model.actualAddress,
                        publishedfeedbacks: Model.feedbacksFromCurrentPlace(Model.actualCoords)
                    });
                });

                Model.clusterer.add(geoObject);

                resolve(feedbackData.feedbackDetails);
            } else {
                reject(emptyFieldList);
            }
        });
    },
    //имеющийся отзыв
    feedbacksFromCurrentPlace(coords) {
        let thisMarkfeedbacks = Model.feedbackData.filter( item => {
            return item.geoObjectCoords[0] === coords[0] &&
                item.geoObjectCoords[1] === coords[1];
        }),
           feedbacksArray = [];
        for(let feedback of thisMarkfeedbacks) {
            feedbacksArray.push(feedback.feedbackDetails);
        }
        return feedbacksArray;
    },
    addDataToFeedback(clickCoords, geoCoords) {
        Model.getAdressFromCoords(geoCoords).then( address => {
            Router.handle('openPopup', {
                clickCoords: clickCoords,
                address: address,
                publishedfeedbacks: Model.feedbacksFromCurrentPlace(geoCoords)
            });
        });
    }
};
//открываем попап, закрываем, выделяем пустые инпуты, кастомизируем кластеры якарт
let View = {
    render(templateName, model) {
        templateName = `${templateName}Template`;
        let templateElement = document.getElementById(templateName),
            templateSource = templateElement.innerHTML,
            renderFn = Handlebars.compile(templateSource);

        return renderFn(model);
    },
    showPopup(elemId, coords) {
        let elem = document.getElementById(elemId);
        elem.style.left = coords[0] + 'px';
        elem.style.top = coords[1] + '100px';
        // +100px чтобы отображался плюс минус по центру по y-оси
        let rect = elem.getBoundingClientRect();
        if(rect.right >= document.documentElement.clientWidth ||
            rect.bottom >= document.documentElement.clientHeight) {
            elem.style.left = '40%';
            elem.style.top = '30%';
            Model.map.panTo(Model.actualCoords);
        }
        elem.classList.add('open_popup');
    },
    close(elemId) {
        let elem = document.getElementById(elemId);
        elem.classList.remove('open_popup');
    },
    indicateEmptyInputs(emptyFieldList) {
        emptyFieldList.forEach( item => {
            item.classList.add('popup__feedback_field_error');
        });
    },
    deleteIndicator(field) {
        if(field.classList.contains('popup__feedback_field_error')) {
            field.classList.remove('popup__feedback_field_error');
        }
    },
    customBallonLayout() {
        return ymaps.templateLayoutFactory.createClass(
            `<div class=balloon>
      	<div class=balloon__body>
      	<h3 class=balloon__title>{{ properties.place }}</h3>
      		<span class=ballon__address 
      			 onclick="Router.handle( openSelectedObject, {{ properties.coords }}, event)">
      			 	{{ properties.address }}
      		</span>
      		<p>
      		{{ properties.feedbackText }}
      		</p>
      		 <div class=balloon_footer>{{ properties.timeOfFeedback }}</div>
      	</div>
      </div>
     `
        );
    },
};
let Controller = {
    openPopupRoute(Args) {
        let model = Args[0];
        popup.innerHTML = View.render('Popup', model);
        View.showPopup('popup', model.clickCoords);
    },
    closePopupRoute() {
        View.close('popup');
    },
    addfeedbackRoute() {
        Model.addFeedback().then( feedbackData => {
                let feedbackListContent = feedbackList.innerHTML;
                if(feedbackListContent.includes('Отзывов пока нет')) {
                    feedbackList.innerHTML = '';
                }
                feedbackList.innerHTML += View.render('addFeedback', feedbackData);
                feedbackForm.reset();
            },
            emptyFieldList => {
                View.indicateEmptyInputs(emptyFieldList);
            });
    },
    removeErrorClassRoute(Args) {
        View.deleteIndicator(Args[0]);
    },
    openSelectedObjectRoute(Args) {
        Model.clusterer.balloon.close();
        let event = Args[2];
        event.preventDefault();
        let clickCoords = [event.pageX, event.pageY],
            geoCoords = [Args[0], Args[1]];
        Model.addDataToFeedback(clickCoords, geoCoords);
    },
};
let Router = {
    handle(route, ...Args) {
        let routeName = `${route}Route`;

        Controller[routeName](Args);
    }
};
