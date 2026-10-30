import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Drone {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        
        // Settings
        this.thrustForce = 22; // Responsive climb on mobile and desktop
        this.rotationSpeed = 1.0;
        this.tiltForce = 5;
        this.maxTiltAngle = (30 * Math.PI) / 180; // 30° maximum tilt limit (prevents flips)
        this._pitchInput = 0;
        this._rollInput = 0;
        
        this.initMesh();
        this.initPhysics();
    }

    initMesh() {
        this.group = new THREE.Group();
        
        // Central Body (Multi-material for top/bottom)
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        
        const sideMat = new THREE.MeshPhongMaterial({ color: 0x222222, emissive: 0x00f2ff, emissiveIntensity: 0.1 });
        const topMat = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.2 }); // Green Top
        const botMat = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.2 }); // Red Bottom
        
        // Face indices: 0: R, 1: L, 2: Top, 3: Bot, 4: Front, 5: Back
        const bodyMaterials = [sideMat, sideMat, topMat, botMat, sideMat, sideMat];
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterials);
        this.group.add(bodyMesh);

        // Front Marker (assuming -Z is forward for three.js and controls)
        const frontGeo = new THREE.BoxGeometry(0.2, 0.12, 0.1);
        const frontMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 }); // Yellow/Orange marker
        const frontMesh = new THREE.Mesh(frontGeo, frontMat);
        frontMesh.position.set(0, 0, -0.26); // Stick out at the -Z front
        this.group.add(frontMesh);
        
        // Proportions/Arms
        const armGeo = new THREE.BoxGeometry(0.8, 0.05, 0.05);
        const armMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
        
        const arm1 = new THREE.Mesh(armGeo, armMat);
        arm1.rotation.y = Math.PI / 4;
        this.group.add(arm1);
        
        const arm2 = new THREE.Mesh(armGeo, armMat);
        arm2.rotation.y = -Math.PI / 4;
        this.group.add(arm2);
        
        // Rotors (Neon Circles)
        const rotorGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16);
        const rotorMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.6 });
        
        this.rotors = [];
        const positions = [
            [0.3, 0.05, 0.3], [-0.3, 0.05, 0.3],
            [0.3, 0.05, -0.3], [-0.3, 0.05, -0.3]
        ];
        
        this.thrustTrails = [];

        positions.forEach(pos => {
            const rotor = new THREE.Mesh(rotorGeo, rotorMat);
            rotor.position.set(...pos);
            this.group.add(rotor);
            this.rotors.push(rotor);
            
            // Thrust trail for each rotor
            const trailGeo = new THREE.CylinderGeometry(0.12, 0.05, 1, 8);
            trailGeo.translate(0, -0.5, 0); // Origin at top so it scales downward
            const trailMat = new THREE.MeshBasicMaterial({ 
                color: 0x00f2ff, 
                transparent: true, 
                opacity: 0.0, 
                blending: THREE.AdditiveBlending 
            });
            const trail = new THREE.Mesh(trailGeo, trailMat);
            trail.position.set(...pos);
            this.group.add(trail);
            this.thrustTrails.push(trail);
        });

        this.scene.add(this.group);
    }

    initPhysics() {
        const shape = new CANNON.Box(new CANNON.Vec3(0.25, 0.05, 0.25));
        this.body = new CANNON.Body({
            mass: 1,
            linearDamping: 0.3, // Reduced from 0.8 to allow higher top speeds
            angularDamping: 0.8 // Kept high for flight stability
        });
        this.body.addShape(shape);
        this.body.position.set(0, 1.5, 0);
        this.physicsWorld.addBody(this.body);
    }

    update(state) {
        // Sync Mesh with Physics Body
        this.group.position.set(
            this.body.position.x,
            this.body.position.y,
            this.body.position.z
        );
        this.group.quaternion.set(
            this.body.quaternion.x,
            this.body.quaternion.y,
            this.body.quaternion.z,
            this.body.quaternion.w
        );
        
        // Engine Visual feedback
        const baseThrust = state ? Math.max(0.1, state.thrust) : 0.1;
        const pitchInput = state ? state.pitch : 0;
        const rollInput  = state ? state.roll  : 0;
        
        // Spin Rotors & modulate thrust trails
        // Rotor indices: 0: RearRight, 1: RearLeft, 2: FrontRight, 3: FrontLeft
        this.rotors.forEach((r, i) => {
            let engineLoad = baseThrust;
            
            // Front / Back pitch bias
            if (pitchInput > 0 && i < 2) engineLoad += pitchInput; // rear works harder to tilt forward
            if (pitchInput < 0 && i >= 2) engineLoad -= pitchInput; // front works harder to tilt back
            
            // Left / Right roll bias
            if (rollInput > 0 && i % 2 !== 0) engineLoad += rollInput; // left works harder to roll right
            if (rollInput < 0 && i % 2 === 0) engineLoad -= rollInput; // right works harder to roll left
            
            engineLoad = Math.max(0.1, engineLoad); // Minimum idle load
            
            // Spin velocity
            r.rotation.y += 0.3 * (1 + engineLoad);
            
            // Glow intensity
            r.material.opacity = 0.4 + (engineLoad * 0.2);
            
            // Trails
            const trail = this.thrustTrails[i];
            if (trail) {
                 const targetScale = Math.max(0.01, engineLoad * 1.5);
                 trail.scale.y = THREE.MathUtils.lerp(trail.scale.y, targetScale, 0.2);
                 trail.material.opacity = THREE.MathUtils.lerp(trail.material.opacity, engineLoad * 0.3, 0.2);
            }
        });
    }

    applyThrust(amount) {
        // Auto-hover baseline to counteract gravity (mass 1 * 9.82 m/s^2)
        const hoverForce = 9.82;
        let totalForce = hoverForce;

        if (amount > 0) {
            totalForce += amount * (this.thrustForce - hoverForce);
        } else if (amount < 0) {
            totalForce += amount * hoverForce;
        }

        // Auto-hover tilt compensation:
        // When tilted, the vertical world component of thrust is totalForce * cos(tilt).
        // Dividing totalForce by cos(tilt) ensures the drone maintains altitude when pitching/rolling!
        const localUp = this.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
        const tiltCos = Math.max(0.5, localUp.y);
        const compensatedForce = totalForce / tiltCos;

        // Upward force in local coordinates
        const force = new CANNON.Vec3(0, compensatedForce, 0);
        const worldForce = this.body.quaternion.vmult(force);
        // CANNON's applyForce takes a force and a relativePoint (offset from center of mass)
        this.body.applyForce(worldForce, new CANNON.Vec3(0, 0, 0));
    }

    moveForward(amount) {
        this._pitchInput = amount;
    }

    moveSideways(amount) {
        this._rollInput = amount;
    }

    rotate(amount) {
        // Yaw
        const localTorque = new CANNON.Vec3(0, amount * this.rotationSpeed, 0);
        const worldTorque = this.body.quaternion.vmult(localTorque);
        this.body.applyTorque(worldTorque);
    }

    autoLevel(pitchState = 0, rollState = 0) {
        // Attitude Controller with strict 30° Max Tilt Angle Limiter
        // Like real commercial flight controllers (DJI / PX4 Angle Mode), stick inputs
        // request a target tilt angle. The drone tilts to the requested angle (up to 30°)
        // and holds it steadily, eliminating flipping and uncontrollable tumbling.

        // Get inputs (from parameters or cached from moveForward/moveSideways)
        const pitchInput = pitchState !== 0 ? pitchState : (this._pitchInput || 0);
        const rollInput = rollState !== 0 ? rollState : (this._rollInput || 0);

        this._pitchInput = 0;
        this._rollInput = 0;

        // Bounded target angles in radians (clamped so combined diagonal tilt never exceeds 30°)
        let targetPitch = -pitchInput * this.maxTiltAngle;
        let targetRoll = -rollInput * this.maxTiltAngle;
        const totalTarget = Math.hypot(targetPitch, targetRoll);
        if (totalTarget > this.maxTiltAngle) {
            targetPitch = (targetPitch / totalTarget) * this.maxTiltAngle;
            targetRoll = (targetRoll / totalTarget) * this.maxTiltAngle;
        }

        // Current orientation via 'YXZ' Euler angles (decouples Yaw from Pitch and Roll)
        const qThree = new THREE.Quaternion(
            this.body.quaternion.x,
            this.body.quaternion.y,
            this.body.quaternion.z,
            this.body.quaternion.w
        );
        const euler = new THREE.Euler().setFromQuaternion(qThree, 'YXZ');

        // Angular velocity in local coordinates
        const localAngVel = this.body.quaternion.conjugate().vmult(this.body.angularVelocity);

        // PD Attitude Controller (proportional drive to target angle + derivative damping)
        const Kp = 3.5;
        const Kd = 0.6;

        const torquePitch = Kp * (targetPitch - euler.x) - Kd * localAngVel.x;
        const torqueRoll  = Kp * (targetRoll  - euler.z) - Kd * localAngVel.z;

        const localTorque = new CANNON.Vec3(torquePitch, 0, torqueRoll);
        this.body.applyTorque(this.body.quaternion.vmult(localTorque));

        // Hard Anti-Flip Safety Envelope:
        // If an obstacle impact or collision tries to knock the drone past 30°,
        // apply emergency restorative alignment so the drone can NEVER flip upside down.
        const localUp = this.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
        const maxTiltCos = Math.cos(this.maxTiltAngle); // cos(30°) ≈ 0.866

        if (localUp.y < maxTiltCos) {
            const worldUp = new CANNON.Vec3(0, 1, 0);
            const alignAxis = new CANNON.Vec3();
            localUp.cross(worldUp, alignAxis);

            if (localUp.y < 0) {
                // If knocked upside down, apply emergency recovery torque
                if (alignAxis.lengthSquared() < 0.001) alignAxis.set(1, 0, 0);
                alignAxis.scale(10.0, alignAxis);
            } else {
                alignAxis.scale(5.0, alignAxis);
            }
            this.body.applyTorque(alignAxis);

            // Damp excessive tumble momentum
            localAngVel.x *= 0.8;
            localAngVel.z *= 0.8;
            this.body.angularVelocity = this.body.quaternion.vmult(localAngVel);
        }
    }
}
