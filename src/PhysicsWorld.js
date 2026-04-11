import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0); // Normal gravity
        
        // Use better collision detection
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.allowSleep = true;
        
        // Materials
        this.defaultMaterial = new CANNON.Material('default');
        const contactMaterial = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0.1,
                restitution: 0.3,
            }
        );
        this.world.addContactMaterial(contactMaterial);
    }

    update(deltaTime) {
        // Step the physics world
        this.world.step(1 / 60, deltaTime, 3);
    }
    
    addBody(body) {
        this.world.addBody(body);
    }
}
