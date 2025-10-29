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
        text: "Muy buena relación precio-calidad. Los envíos son rápidos aunque una vez tardo un poco más de lo esperado. El catálogo está siempre actualizado y tenes articulos para aburrite jajaj",
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
        text: "Super recomendable! Los dueños son un amor, te responden al instante. Los precios re accesibles. En breve paso otro pedido! 😁",
        hidden: false
    },
    {
        name: "Valentina Sansonetti",
        daysAgo: 39,
        stars: 4,
        text: "Muy buenos productos y la atención es buena aunque a veces demoran un poco en responder. Los precios son competitivos.",
        hidden: false
    },
    {
        name: "Roberto Paz",
        daysAgo: 47,
        stars: 5,
        text: "Compro hace varios meses y nunca tuve problemas. envíos dentro de lo esperado y productos que realmente se venden bien",
        hidden: true
    },
    {
        name: "Lucía Morales",
        daysAgo: 54,
        stars: 5,
        text: "trato humano que no se consigue en cualquier lado. Me ayudaron mucho a crecer mi negocio. Totalmente agradecida!",
        hidden: true
    },
    {
        name: "..",
        daysAgo: 62,
        stars: 3,
        text: "Los productos son aceptables pero tuve un inconveniente con un artículo que llegó dañado. Me lo solucionaron, aunque el proceso fue un poco lento. Los precios están bien para lo que ofrecen. Esperaba algo más de variedad en el catálogo.",
        hidden: true
    },
    {
        name: "Pato",
        daysAgo: 69,
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
    
    // Agregar formulario de nueva reseña
    const reviewFormCard = document.createElement('div');
    reviewFormCard.className = 'review-card review-form-card loading hidden';
    reviewFormCard.id = 'newReviewForm';
    
    reviewFormCard.innerHTML = `
        <div class="new-review-header">
            <i class="fas fa-pen-to-square"></i>
            <h4>Dejanos tu Reseña</h4>
        </div>
        <form class="review-form" id="reviewForm" onsubmit="submitReview(event)">
            <div class="form-group">
                <label for="reviewName">
                    <i class="fas fa-user"></i> Nombre
                </label>
                <input 
                    type="text" 
                    id="reviewName" 
                    name="name" 
                    placeholder="Tu nombre" 
                    required 
                    maxlength="50"
                />
            </div>
            
            <div class="form-group">
                <label for="reviewEmail">
                    <i class="fas fa-envelope"></i> Email
                </label>
                <input 
                    type="email" 
                    id="reviewEmail" 
                    name="email" 
                    placeholder="Email registrado en pedido anterior" 
                    required
                />
            </div>
            
            <div class="form-group">
                <label>
                    <i class="fas fa-star"></i> Calificación
                </label>
                <div class="star-rating" id="starRating">
                    <i class="far fa-star" data-rating="1"></i>
                    <i class="far fa-star" data-rating="2"></i>
                    <i class="far fa-star" data-rating="3"></i>
                    <i class="far fa-star" data-rating="4"></i>
                    <i class="far fa-star" data-rating="5"></i>
                </div>
                <input type="hidden" id="ratingValue" name="rating" value="0" required />
            </div>
            
            <div class="form-group">
                <label for="reviewComment">
                    <i class="fas fa-comment"></i> Comentario
                </label>
                <textarea 
                    id="reviewComment" 
                    name="comment" 
                    placeholder="Contanos tu experiencia..." 
                    required 
                    maxlength="400"
                    rows="4"
                ></textarea>
                <div class="char-counter">
                    <span id="charCount">0</span>/400 caracteres
                </div>
            </div>
            
            <button type="submit" class="submit-review-btn">
                <i class="fas fa-paper-plane"></i> Enviar Reseña
            </button>
        </form>
        
        <div class="success-message" id="successMessage" style="display: none;">
            <i class="fas fa-check-circle"></i>
            <h4>¡Gracias por tu reseña!</h4>
            <p>Apreciamos mucho tu tiempo y tus comentarios. Tu opinión nos ayuda a mejorar cada día.</p>
        </div>
    `;
    
    reviewsGrid.appendChild(reviewFormCard);
    
    // Inicializar eventos del formulario
    initFormEvents();
}

// Función para inicializar eventos del formulario
function initFormEvents() {
    // Sistema de calificación con estrellas
    const stars = document.querySelectorAll('#starRating i');
    const ratingValue = document.getElementById('ratingValue');
    
    stars.forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            ratingValue.value = rating;
            
            stars.forEach((s, index) => {
                if (index < rating) {
                    s.className = 'fas fa-star';
                } else {
                    s.className = 'far fa-star';
                }
            });
        });
        
        star.addEventListener('mouseenter', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            stars.forEach((s, index) => {
                if (index < rating) {
                    s.classList.add('hover');
                }
            });
        });
        
        star.addEventListener('mouseleave', function() {
            stars.forEach(s => {
                s.classList.remove('hover');
            });
        });
    });
    
    // Contador de caracteres
    const commentField = document.getElementById('reviewComment');
    const charCount = document.getElementById('charCount');
    
    if (commentField && charCount) {
        commentField.addEventListener('input', function() {
            charCount.textContent = this.value.length;
        });
    }
}

// Función para enviar la reseña
function submitReview(event) {
    event.preventDefault();
    
    const form = event.target;
    const rating = document.getElementById('ratingValue').value;
    
    // Validar que se haya seleccionado una calificación
    if (rating === '0') {
        alert('Por favor, selecciona una calificación con estrellas');
        return;
    }
    
    // Mostrar animación de carga
    const submitBtn = form.querySelector('.submit-review-btn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    submitBtn.disabled = true;
    
    // Simular envío (con delay para dar sensación de procesamiento)
    setTimeout(() => {
        // Ocultar formulario y mostrar mensaje de éxito
        form.style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';
        
        // Resetear el formulario después de un tiempo
        setTimeout(() => {
            form.reset();
            document.getElementById('ratingValue').value = '0';
            document.getElementById('charCount').textContent = '0';
            
            // Resetear estrellas
            const stars = document.querySelectorAll('#starRating i');
            stars.forEach(s => {
                s.className = 'far fa-star';
            });
            
            // Restaurar botón
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            
            // Volver a mostrar el formulario y ocultar mensaje
            setTimeout(() => {
                form.style.display = 'block';
                document.getElementById('successMessage').style.display = 'none';
            }, 3000);
        }, 4000);
    }, 1500);
    
    return false;
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
