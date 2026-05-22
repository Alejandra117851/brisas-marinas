-- ============================================================================
--  Brisas Marinas — Datos Iniciales (Categorías y Productos)
--  Ejecutar DESPUÉS de schema.sql
--  Los usuarios se crean mediante el script: npm run seed:users
-- ============================================================================

-- Categorías
INSERT INTO categories (name, description) VALUES
('Platos Fuertes',  'Almuerzos y comidas principales del restaurante'),
('Mariscos',        'Pescados, camarones y productos del mar'),
('Bebidas',         'Jugos, gaseosas y bebidas frías'),
('Cocteles',        'Cocteles de la casa y bebidas alcohólicas'),
('Entradas',        'Aperitivos y entradas'),
('Postres',         'Postres y dulces'),
('Acompañamientos', 'Arroz, patacones, ensaladas y guarniciones');

-- Productos
INSERT INTO products (code, name, description, category_id, price, cost, stock, min_stock, unit) VALUES
('PLT001', 'Bandeja Paisa',        'Bandeja con frijoles, arroz, carne, chicharrón, plátano, huevo y arepa', 1, 25000, 12000, 30, 5, 'plato'),
('PLT002', 'Sancocho de Pescado',  'Sancocho costeño con pescado fresco, yuca y plátano',                    1, 22000, 10000, 25, 5, 'plato'),
('PLT003', 'Arroz con Mariscos',   'Arroz mixto con camarones, calamares y caracol',                         1, 32000, 15000, 20, 5, 'plato'),
('MAR001', 'Cazuela de Mariscos',  'Cazuela con camarones, calamares, pescado y leche de coco',              2, 38000, 18000, 15, 5, 'plato'),
('MAR002', 'Camarones al Ajillo',  'Camarones salteados en mantequilla, ajo y vino blanco',                  2, 35000, 16000, 18, 5, 'plato'),
('MAR003', 'Pescado Frito Entero', 'Mojarra frita con patacones, arroz con coco y ensalada',                 2, 28000, 13000, 22, 5, 'plato'),
('MAR004', 'Ceviche Mixto',        'Ceviche de pescado, camarón y calamar con limón y cilantro',             2, 24000, 11000, 20, 5, 'plato'),
('BEB001', 'Jugo Natural',         'Jugo natural en agua o leche (varios sabores)',                          3,  6000,  1800, 80, 15, 'vaso'),
('BEB002', 'Gaseosa Personal',     'Gaseosa de 250 ml',                                                      3,  4000,  2000, 100, 20, 'unidad'),
('BEB003', 'Agua Embotellada',     'Agua mineral 500 ml',                                                    3,  3000,  1200, 60, 15, 'botella'),
('BEB004', 'Limonada de Coco',     'Limonada cremosa con coco',                                              3,  8000,  3000, 50, 10, 'vaso'),
('COC001', 'Coco Loco',            'Coctel de la casa con ron y coco',                                       4, 15000,  6000, 40, 8,  'vaso'),
('COC002', 'Margarita Brisas',     'Margarita tradicional con un toque marino',                              4, 16000,  6500, 35, 8,  'vaso'),
('COC003', 'Piña Colada',          'Coctel cremoso con piña y coco',                                         4, 14000,  5800, 40, 8,  'vaso'),
('ENT001', 'Patacones con Hogao',  'Patacones verdes con hogao casero',                                      5,  8000,  3000, 50, 10, 'porción'),
('ENT002', 'Empanadas (3 unid.)',  'Empanadas de carne, pollo o queso',                                      5,  6000,  2500, 60, 12, 'porción'),
('POS001', 'Cocada',               'Cocada tradicional costeña',                                             6,  5000,  1500, 40, 8,  'unidad'),
('POS002', 'Arroz con Leche',      'Arroz con leche con canela',                                             6,  6000,  2000, 30, 8,  'porción'),
('ACO001', 'Arroz con Coco',       'Porción de arroz con coco titoté',                                       7,  4000,  1200, 80, 15, 'porción'),
('ACO002', 'Patacones',            'Porción de patacones (5 unid.)',                                         7,  4000,  1500, 70, 15, 'porción'),
('ACO003', 'Ensalada Fresca',      'Ensalada de tomate, cebolla y lechuga',                                  7,  3500,  1000, 50, 10, 'porción');

INSERT INTO tables (label, capacity) VALUES
('Mesa 1', 4),
('Mesa 2', 4),
('Mesa 3', 4),
('Mesa 4', 4),
('Mesa 5', 4),
('Mesa 6', 4),
('Mesa 7', 4),
('Mesa 8', 4);
ON CONFLICT DO NOTHING;