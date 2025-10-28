// Datos de las reseñas
const reviewsData = [
    {
        name: "María Valls",
        daysAgo: 3,
        stars: 5,
        text: "Excelente atención. Los precios están muy buenos y la calidad de los productos tambien. Ya hice varios pedidos y siempre todo perfecto",
        hidden: false
    },
    {
        name: "Carlos R.",
        daysAgo: 9,
        stars: 5,
        text: "unos genios! arranque sin mucho conocimiento del rubro y los chicos me tuvieron mucha paciencia respondiendo a todas mis pregntas",
        hidden: false
    },
    {
        name: "Laura",
        daysAgo: 16,
        stars: 4,
        text: "Muy buena relación precio-calidad. Los envíos son rápidos aunque una vez tardo un poco más de lo esperado. La atención siempre amable.",
        hidden: false
    },
    {
        name: "Javier Martínez",
        daysAgo: 23,
        stars: 5,
        text: "La atención personalizada es lo que más valoro. Te asesoran bien y te dan ideas para mejorar las ventas. Gracias!!!!",
        hidden: false
    },
    {
        name: "Sofi 😊",
        daysAgo: 31,
        stars: 5,
        text: "Super recomendable! Los dueños son un amor, te responden al instante. Los precios re accesibles. En breve paso otro pedido 😁!",
        hidden: false
    },
    {
        name: "Diego Torrales",
        daysAgo: 38,
        stars: 5,
        text: "Hacía tiempo que buscaba un proveedor asi.. Precios justos, buena calidad y excelente atención al cliente. El catálogo está siempre actualizado y tenes articulos para aburrite jajaj",
        hidden: false
    },
    {
        name: "Valentina Sansonetti",
        daysAgo: 47,
        stars: 4,
        text: "Muy buenos productos y la atención es buena aunque a veces demoran un poco en responder. Los precios son competitivos.",
        hidden: true
    },
    {
        name: "Roberto Paz",
        daysAgo: 54,
        stars: 5,
        text: "Compro hace varios meses y nunca tuve problemas. envíos dentro de lo esperado y productos que realmente se venden bien",
        hidden: true
    },
    {
        name: "Lucía Morales",
        daysAgo: 62,
        stars: 5,
        text: "trato humano que no se consigue en cualquier lado. Me ayudaron mucho a crecer mi negocio. Totalmente agradecida!",
        hidden: true
    },
    {
        name: "..",
        daysAgo: 68,
        stars: 3,
        text: "Los productos son aceptables pero tuve un inconveniente con un artículo que llegó dañado. Me lo solucionaron, aunque el proceso fue un poco lento. Los precios están bien para lo que ofrecen. Esperaba algo más de variedad en el catálogo.",
        hidden: true
    },
    {
        name: "Pato",
        daysAgo: 71,
        stars: 4,
        text: "Buena experiencia en general. La comunicación es fluida y responden rápido. Solo le quito una estrella porque algunos productos no tenían stock y tuve que esperar. Pero vale la pena, son serios.",
        hidden: true
    },
    {
        name: "Ezequiel Santos",
        daysAgo: 75,
        stars: 5,
        text: "IMPRESIONANTE!! Hace años que compro en varios lugares y nunca encontré una atención tan dedicada. Los dueños realmente se involucran, te conocen por tu nombre y te hacen sentir importante. Los productos llegan en tiempo y forma, y la calidad supera mis expectativas. Si estás arrancando tu negocio, este es EL LUGAR para comprar. No tengo absolutamente nada negativo para decir. Mil puntos!!",
        hidden: true
    }
];

// Función para generar las estrellas
function generateStars(count) {
    let starsHTML = '';
    for (let i = 0; i < 5; i++) {
        if (i < count) {
            starsHTML += '<i class="fas fa-star"></i>';
        } else {
            starsHTML += '<i class="far fa-star"></i>';
        }
    }
    return starsHTML;
}

// Función para calcular la fecha
function calculateDate(daysAgo) {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const today = new Date();
    const reviewDate = new Date(today);
    reviewDate.setDate(today.getDate() - daysAgo);
    
    const day = reviewDate.getDate();
    const month = months[reviewDate.getMonth()];
    const year = reviewDate.getFullYear();
    
    return `${day} de ${month} de ${year}`;
}

// Función para renderizar las reseñas
function renderReviews() {
    const reviewsGrid = document.getElementById('reviewsGrid');
    if (!reviewsGrid) return;
    
    reviewsGrid.innerHTML = '';
    
    reviewsData.forEach((review, index) => {
        const reviewCard = document.createElement('div');
        reviewCard.className = `review-card loading${review.hidden ? ' hidden' : ''}`;
        reviewCard.setAttribute('data-days-ago', review.daysAgo);
        
        reviewCard.innerHTML = `
            <i class="fas fa-quote-right review-icon"></i>
            <div class="review-header">
                <div>
                    <div class="review-name">${review.name}</div>
                    <div class="review-date">${calculateDate(review.daysAgo)}</div>
                </div>
                <div class="review-stars">
                    ${generateStars(review.stars)}
                </div>
            </div>
            <p class="review-text">
                ${review.text}
            </p>
        `;
        
        reviewsGrid.appendChild(reviewCard);
    });
}

// Función para mostrar/ocultar reseñas
function toggleReviews() {
    const hiddenReviews = document.querySelectorAll('.review-card.hidden');
    const btn = document.getElementById('showMoreBtn');
    
    if (hiddenReviews.length > 0) {
        hiddenReviews.forEach(review => {
            review.classList.remove('hidden');
        });
        btn.innerHTML = '<i class="fas fa-chevron-up"></i> Ver menos reseñas';
    } else {
        const allReviews = document.querySelectorAll('.review-card');
        allReviews.forEach((review, index) => {
            if (index >= 6) {
                review.classList.add('hidden');
            }
        });
        btn.innerHTML = '<i class="fas fa-chevron-down"></i> Ver más reseñas';
    }
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    renderReviews();
});
