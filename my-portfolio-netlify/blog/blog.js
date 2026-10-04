// Mobile menu toggle — same behaviour as index.html
document.getElementById('burgerBtn').addEventListener('click', function(){
  var m = document.getElementById('mobile-menu');
  var open = m.classList.toggle('open');
  this.setAttribute('aria-expanded', open);
});
document.querySelectorAll('#mobile-menu a').forEach(function(a){
  a.addEventListener('click', function(){document.getElementById('mobile-menu').classList.remove('open');});
});

// Scroll-reveal — same behaviour as index.html
try{
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, {threshold:.12});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});
}catch(e){
  document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('in');});
}

// Search + category filter for the blog listing page.
// Only runs if the filter bar is present (i.e. on /blog/index.html).
(function(){
  var searchInput = document.getElementById('blogSearch');
  var tagButtons = document.querySelectorAll('.filter-tag');
  var cards = document.querySelectorAll('.article-card[data-title]');
  var emptyState = document.getElementById('filterEmpty');
  if (!searchInput && !tagButtons.length) return;

  var activeTag = 'all';

  function applyFilter(){
    var q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    var visibleCount = 0;
    cards.forEach(function(card){
      var title = (card.dataset.title || '').toLowerCase();
      var excerpt = (card.dataset.excerpt || '').toLowerCase();
      var category = card.dataset.category || '';
      var matchesTag = activeTag === 'all' || category === activeTag;
      var matchesSearch = !q || title.indexOf(q) !== -1 || excerpt.indexOf(q) !== -1;
      var show = matchesTag && matchesSearch;
      card.classList.toggle('is-hidden', !show);
      if (show) visibleCount++;
    });
    if (emptyState) emptyState.classList.toggle('show', visibleCount === 0);
  }

  tagButtons.forEach(function(btn){
    btn.addEventListener('click', function(){
      tagButtons.forEach(function(b){ b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed','true');
      activeTag = btn.dataset.tag;
      applyFilter();
    });
  });

  if (searchInput){
    searchInput.addEventListener('input', applyFilter);
  }
})();
